import { ethers } from "hardhat";
import { smock } from "@defi-wonderland/smock";
import chai, { expect } from "chai";
import { Signer, BigNumber } from "ethers";
import { toERC20 } from "../param/helper";
import {
  ChainLinkMock,
  PriceFeedV3,
  FeePool,
  CurrencyOS,
  CJPY,
  Yamato,
  YamatoDepositor,
  YamatoBorrower,
  YamatoRepayer,
  YamatoWithdrawer,
  YamatoRedeemer,
  YamatoSweeper,
  PriorityRegistry,
  Pool,
  ChainLinkMock__factory,
  PriceFeedV3__factory,
  FeePool__factory,
  CurrencyOS__factory,
  CJPY__factory,
  Yamato__factory,
  YamatoDepositor__factory,
  YamatoBorrower__factory,
  YamatoRepayer__factory,
  YamatoWithdrawer__factory,
  YamatoRedeemer__factory,
  YamatoSweeper__factory,
  Pool__factory,
  PriorityRegistry__factory,
} from "../../typechain";
import { getProxy, getLinkedProxy } from "../../src/testUtil";

chai.use(smock.matchers);

describe("burnCurrency :: contract Yamato", () => {
  let ChainLinkEthUsd: ChainLinkMock;
  let ChainLinkUsdJpy: ChainLinkMock;
  let PriceFeed: PriceFeedV3;
  let CJPY: CJPY;
  let FeePool: FeePool;
  let CurrencyOS: CurrencyOS;
  let Yamato: Yamato;
  let YamatoDepositor: YamatoDepositor;
  let YamatoBorrower: YamatoBorrower;
  let YamatoRepayer: YamatoRepayer;
  let YamatoWithdrawer: YamatoWithdrawer;
  let YamatoRedeemer: YamatoRedeemer;
  let YamatoSweeper: YamatoSweeper;
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

    PriceFeed = await getProxy<PriceFeedV3, PriceFeedV3__factory>(
      "PriceFeed",
      [ChainLinkEthUsd.address, ChainLinkUsdJpy.address],
      3
    );

    CJPY = await (<CJPY__factory>(
      await ethers.getContractFactory("CJPY")
    )).deploy();

    FeePool = await getProxy<FeePool, FeePool__factory>("FeePool", []);

    CurrencyOS = await getProxy<CurrencyOS, CurrencyOS__factory>("CurrencyOS", [
      CJPY.address,
      PriceFeed.address,
      FeePool.address,
    ]);

    Yamato = await getLinkedProxy<Yamato, Yamato__factory>(
      "Yamato",
      [CurrencyOS.address],
      ["PledgeLib"]
    );

    YamatoDepositor = await getLinkedProxy<
      YamatoDepositor,
      YamatoDepositor__factory
    >("YamatoDepositor", [Yamato.address], ["PledgeLib"]);

    YamatoBorrower = await getLinkedProxy<
      YamatoBorrower,
      YamatoBorrower__factory
    >("YamatoBorrower", [Yamato.address], ["PledgeLib"]);

    YamatoRepayer = await getLinkedProxy<YamatoRepayer, YamatoRepayer__factory>(
      "YamatoRepayer",
      [Yamato.address],
      ["PledgeLib"]
    );

    YamatoWithdrawer = await getLinkedProxy<
      YamatoWithdrawer,
      YamatoWithdrawer__factory
    >("YamatoWithdrawer", [Yamato.address], ["PledgeLib"]);

    YamatoRedeemer = await getLinkedProxy<
      YamatoRedeemer,
      YamatoRedeemer__factory
    >("YamatoRedeemer", [Yamato.address], ["PledgeLib"]);

    YamatoSweeper = await getLinkedProxy<YamatoSweeper, YamatoSweeper__factory>(
      "YamatoSweeper",
      [Yamato.address],
      ["PledgeLib"]
    );

    Pool = await getProxy<Pool, Pool__factory>("Pool", [Yamato.address]);

    PriorityRegistry = await getLinkedProxy<
      PriorityRegistry,
      PriorityRegistry__factory
    >("PriorityRegistry", [Yamato.address], ["PledgeLib"]);

    await (
      await Yamato.setDeps(
        YamatoDepositor.address,
        YamatoBorrower.address,
        YamatoRepayer.address,
        YamatoWithdrawer.address,
        YamatoRedeemer.address,
        YamatoSweeper.address,
        Pool.address,
        PriorityRegistry.address
      )
    ).wait();
    await (await CurrencyOS.addYamato(Yamato.address)).wait();
    await (await CJPY.setCurrencyOS(CurrencyOS.address)).wait();
  });

  describe("redeem()", function () {
    let PRICE;
    const MCR = BigNumber.from(130);
    let toCollateralize;
    let toBorrow;

    beforeEach(async () => {
      await (await ChainLinkEthUsd.setLastPrice("404000000000")).wait(); //dec8

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
        await Yamato.connect(redeemerSigner).redeem(
          toERC20(toBorrow.div(2) + ""),
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
