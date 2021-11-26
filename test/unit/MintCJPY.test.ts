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

describe("MintCJPY :: contract Yamato", () => {
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
      [Yamato.address],
      ["PledgeLib"]
    );

    Pool = await (<Pool__factory>(
      await ethers.getContractFactory("Pool")
    )).deploy(YamatoHelper.address);

    PriorityRegistry = await getLinkedProxy<
      PriorityRegistry,
      PriorityRegistry__factory
    >("PriorityRegistry", [YamatoHelper.address], ["PledgeLib"]);

    await (await Yamato.setPool(Pool.address)).wait();
    await (
      await Yamato.setPriorityRegistry(PriorityRegistry.address)
    ).wait();
    await (await Yamato.setYamatoHelper(YamatoHelper.address)).wait();
    await (await CjpyOS.addYamato(Yamato.address)).wait();
    await (await CJPY.setCurrencyOS(CjpyOS.address)).wait();
  });

  describe("borrow()", function () {
    it(`should mint CJPY`, async function () {
      await (await PriceFeed.fetchPrice()).wait();
      const PRICE = await PriceFeed.lastGoodPrice();

      const MCR = BigNumber.from(110);
      const toCollateralize = 1;
      const toBorrow = PRICE.mul(toCollateralize)
        .mul(100)
        .div(MCR)
        .div(1e18 + "");
      await Yamato.deposit({ value: toERC20(toCollateralize + "") });

      const totalSupplyBefore = await CJPY.totalSupply();
      await Yamato.borrow(toERC20(toBorrow + ""));
      const totalSupplyAfter = await CJPY.totalSupply();

      expect(totalSupplyAfter).to.be.gt(totalSupplyBefore);

      const eoaBalance = await CJPY.balanceOf(await accounts[0].getAddress());
      expect(eoaBalance).to.be.gt(0);

      const caBalance = await CJPY.balanceOf(Pool.address);
      expect(caBalance).to.be.gt(0);

      expect(eoaBalance.add(caBalance)).to.eq(toBorrow.mul(1e18 + ""));
    });
  });
});
