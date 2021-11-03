import { ethers } from "hardhat";
import { smock } from "@defi-wonderland/smock";
import chai, { expect } from "chai";
import { solidity } from "ethereum-waffle";
import { Signer, BigNumber } from "ethers";
import { toERC20 } from "../param/helper";
import {
  ChainLinkMock,
  TellorCallerMock,
  PriceFeed,
  FeePool,
  CjpyOS,
  CJPY,
  Yamato,
  YamatoHelper,
  PriorityRegistry,
  Pool,
  ChainLinkMock__factory,
  TellorCallerMock__factory,
  PriceFeed__factory,
  FeePool__factory,
  CjpyOS__factory,
  CJPY__factory,
  Yamato__factory,
  YamatoHelper__factory,
  Pool__factory,
  PriorityRegistry__factory,
} from "../../typechain";
import { getProxy, getLinkedProxy } from "../../src/testUtil";

chai.use(smock.matchers);
chai.use(solidity);

describe("BurnCJPY :: contract Yamato", () => {
  let ChainLinkEthUsd: ChainLinkMock;
  let ChainLinkUsdJpy: ChainLinkMock;
  let Tellor: TellorCallerMock;
  let PriceFeed: PriceFeed;
  let CJPY: CJPY;
  let FeePool: FeePool;
  let CjpyOS: CjpyOS;
  let Yamato: Yamato;
  let YamatoHelper: YamatoHelper;
  let Pool: Pool;
  let PriorityRegistry: PriorityRegistry;
  let accounts: Signer[];
  let ownerAddress: string;
  let userAddress: string;

  beforeEach(async () => {
    accounts = await ethers.getSigners();
    ownerAddress = await accounts[0].getAddress();
    userAddress = await accounts[1].getAddress();

    ChainLinkEthUsd = await (<ChainLinkMock__factory>(
      await ethers.getContractFactory("ChainLinkMock")
    )).deploy("ETH/USD");
    ChainLinkUsdJpy = await (<ChainLinkMock__factory>(
      await ethers.getContractFactory("ChainLinkMock")
    )).deploy("JPY/USD");

    await (
      await ChainLinkEthUsd.connect(accounts[0]).simulatePriceMove({
        gasLimit: 200000,
      })
    ).wait();
    await (
      await ChainLinkUsdJpy.connect(accounts[0]).simulatePriceMove({
        gasLimit: 200000,
      })
    ).wait();
    await (
      await ChainLinkEthUsd.connect(accounts[0]).simulatePriceMove({
        gasLimit: 200000,
      })
    ).wait();
    await (
      await ChainLinkUsdJpy.connect(accounts[0]).simulatePriceMove({
        gasLimit: 200000,
      })
    ).wait();

    Tellor = await (<TellorCallerMock__factory>(
      await ethers.getContractFactory("TellorCallerMock")
    )).deploy();

    PriceFeed = await getProxy<PriceFeed, PriceFeed__factory>("PriceFeed", [
      ChainLinkEthUsd.address,
      ChainLinkUsdJpy.address,
      Tellor.address,
    ]);

    CJPY = await (<CJPY__factory>(
      await ethers.getContractFactory("CJPY")
    )).deploy();

    FeePool = await (<FeePool__factory>(
      await ethers.getContractFactory("FeePool")
    )).deploy();

    CjpyOS = await (<CjpyOS__factory>(
      await ethers.getContractFactory("CjpyOS")
    )).deploy(
      CJPY.address,
      PriceFeed.address,
      FeePool.address
      // governance=deployer
    );


    Yamato = await getLinkedProxy<Yamato, Yamato__factory>(
      "Yamato",
      [CjpyOS.address],
      ["PledgeLib"]
    );

    YamatoHelper = await getLinkedProxy<YamatoHelper, YamatoHelper__factory>(
      "YamatoHelper",
      [YamatoHelper.address],
      ["PledgeLib"]
    );

    Pool = await (<Pool__factory>(
      await ethers.getContractFactory("Pool")
    )).deploy(YamatoHelper.address);

    PriorityRegistry = await getLinkedProxy<
      PriorityRegistry,
      PriorityRegistry__factory
    >("PriorityRegistry", [YamatoHelper.address], ["PledgeLib"]);

    await (await YamatoHelper.setPool(Pool.address)).wait();
    await (await YamatoHelper.setPriorityRegistry(PriorityRegistry.address)).wait();
    await (await Yamato.setYamatoHelper(YamatoHelper.address)).wait()
    await (await CjpyOS.addYamato(Yamato.address)).wait();
    await (await CJPY.setCurrencyOS(CjpyOS.address)).wait();
  });

  describe("redeem()", function () {
    let PRICE;
    const MCR = BigNumber.from(110);
    let toCollateralize;
    let toBorrow;

    beforeEach(async () => {
      await (await PriceFeed.fetchPrice()).wait();
      PRICE = await PriceFeed.lastGoodPrice();
      toCollateralize = 1;
      toBorrow = PRICE.mul(toCollateralize)
        .mul(100)
        .div(MCR)
        .div(1e18 + "");

      /* Set lower ICR */
      await Yamato.connect(accounts[0]).deposit({
        value: toERC20(toCollateralize * 10 + ""),
      }); // Larger deposit
      await Yamato.connect(accounts[0]).borrow(toERC20(toBorrow.mul(10) + ""));
      await Yamato.connect(accounts[1]).deposit({
        value: toERC20(toCollateralize + ""),
      });
      await Yamato.connect(accounts[1]).borrow(toERC20(toBorrow + ""));
      await Yamato.connect(accounts[2]).deposit({
        value: toERC20(toCollateralize + ""),
      });
      await Yamato.connect(accounts[2]).borrow(toERC20(toBorrow + ""));

      /* Market Dump */
      await (await ChainLinkEthUsd.setLastPrice("204000000000")).wait(); //dec8
      await (await Tellor.setLastPrice("203000000000")).wait(); //dec8

      /* Set higher ICR */
      await Yamato.connect(accounts[3]).deposit({
        value: toERC20(toCollateralize * 3 + ""),
      });
      await Yamato.connect(accounts[3]).borrow(toERC20(toBorrow + ""));
      await Yamato.connect(accounts[4]).deposit({
        value: toERC20(toCollateralize * 3 + ""),
      });
      await Yamato.connect(accounts[4]).borrow(toERC20(toBorrow + ""));
      await Yamato.connect(accounts[5]).deposit({
        value: toERC20(toCollateralize * 3 + ""),
      });
      await Yamato.connect(accounts[5]).borrow(toERC20(toBorrow + ""));
    });

    it(`should burn CJPY`, async function () {
      let redeemerSigner = accounts[0];
      let redeemerAddr = await redeemerSigner.getAddress();
      const totalSupplyBefore = await CJPY.totalSupply();
      const eoaCJPYBalanceBefore = await CJPY.balanceOf(redeemerAddr);
      const eoaETHBalanceBefore = await Yamato.provider.getBalance(
        redeemerAddr
      );

      const txReceipt = await (
        await Yamato.connect(accounts[0]).redeem(
          toERC20(toBorrow.mul(3) + ""),
          false
        )
      ).wait();

      const totalSupplyAfter = await CJPY.totalSupply();
      const eoaCJPYBalanceAfter = await CJPY.balanceOf(redeemerAddr);
      const eoaETHBalanceAfter = await Yamato.provider.getBalance(redeemerAddr);

      expect(totalSupplyAfter).to.be.lt(totalSupplyBefore);
      expect(eoaCJPYBalanceAfter).to.be.lt(eoaCJPYBalanceBefore);
      expect(eoaETHBalanceAfter.add(txReceipt.gasUsed)).to.be.gt(
        eoaETHBalanceBefore
      ); //gas?
    });
  });
});
