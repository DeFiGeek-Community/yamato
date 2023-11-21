import { ethers } from "hardhat";
import { smock } from "@defi-wonderland/smock";
import chai, { expect } from "chai";
import { Signer, BigNumber } from "ethers";
import {
  takeSnapshot,
  SnapshotRestorer,
} from "@nomicfoundation/hardhat-network-helpers";
import { toERC20 } from "../param/helper";
import {
  ChainLinkMock,
  PriceFeedV3,
  FeePool,
  CurrencyOS,
  CJPY,
  YamatoV4,
  YamatoDepositor,
  YamatoBorrower,
  YamatoRepayer,
  YamatoWithdrawer,
  YamatoRedeemer,
  YamatoSweeper,
  PriorityRegistry,
  Pool,
  YMT,
  VeYMT,
  ScoreWeightController,
  YmtMinter,
  ScoreRegistry,
  ChainLinkMock__factory,
  PriceFeedV3__factory,
  FeePool__factory,
  CurrencyOS__factory,
  CJPY__factory,
  YamatoV4__factory,
  YamatoDepositor__factory,
  YamatoBorrower__factory,
  YamatoRepayer__factory,
  YamatoWithdrawer__factory,
  YamatoRedeemer__factory,
  YamatoSweeper__factory,
  Pool__factory,
  PriorityRegistry__factory,
  YMT__factory,
  VeYMT__factory,
  ScoreWeightController__factory,
  YmtMinter__factory,
  ScoreRegistry__factory,
} from "../../typechain";
import { getProxy, getLinkedProxy } from "../../src/testUtil";
import { contractVersion } from "../param/version";

chai.use(smock.matchers);

describe("burnCurrency :: contract Yamato", () => {
  let ChainLinkEthUsd: ChainLinkMock;
  let ChainLinkUsdJpy: ChainLinkMock;
  let PriceFeed: PriceFeedV3;
  let CJPY: CJPY;
  let FeePool: FeePool;
  let CurrencyOS: CurrencyOS;
  let Yamato: YamatoV4;
  let YamatoDepositor: YamatoDepositor;
  let YamatoBorrower: YamatoBorrower;
  let YamatoRepayer: YamatoRepayer;
  let YamatoWithdrawer: YamatoWithdrawer;
  let YamatoRedeemer: YamatoRedeemer;
  let YamatoSweeper: YamatoSweeper;
  let Pool: Pool;
  let PriorityRegistry: PriorityRegistry;
  let ScoreRegistry: ScoreRegistry;
  let YmtMinter: YmtMinter;
  let veYMT: VeYMT;
  let YMT: YMT;
  let ScoreWeightController: ScoreWeightController;
  let accounts: Signer[];
  let ownerAddress: string;
  let userAddress: string;

  let snapshot: SnapshotRestorer;

  before(async () => {
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
      contractVersion["PriceFeed"],
      [ChainLinkEthUsd.address, ChainLinkUsdJpy.address]
    );

    CJPY = await (<CJPY__factory>(
      await ethers.getContractFactory("CJPY")
    )).deploy();

    FeePool = await getProxy<FeePool, FeePool__factory>(
      contractVersion["FeePool"],
      []
    );

    CurrencyOS = await getProxy<CurrencyOS, CurrencyOS__factory>(
      contractVersion["CurrencyOS"],
      [CJPY.address, PriceFeed.address, FeePool.address]
    );

    Yamato = await getLinkedProxy<YamatoV4, YamatoV4__factory>(
      contractVersion["Yamato"],
      [CurrencyOS.address],
      ["PledgeLib"]
    );

    YamatoDepositor = await getLinkedProxy<
      YamatoDepositor,
      YamatoDepositor__factory
    >(contractVersion["YamatoDepositor"], [Yamato.address], ["PledgeLib"]);

    YamatoBorrower = await getLinkedProxy<
      YamatoBorrower,
      YamatoBorrower__factory
    >(contractVersion["YamatoBorrower"], [Yamato.address], ["PledgeLib"]);

    YamatoRepayer = await getLinkedProxy<YamatoRepayer, YamatoRepayer__factory>(
      contractVersion["YamatoRepayer"],
      [Yamato.address],
      ["PledgeLib"]
    );

    YamatoWithdrawer = await getLinkedProxy<
      YamatoWithdrawer,
      YamatoWithdrawer__factory
    >(contractVersion["YamatoWithdrawer"], [Yamato.address], ["PledgeLib"]);

    YamatoRedeemer = await getLinkedProxy<
      YamatoRedeemer,
      YamatoRedeemer__factory
    >(contractVersion["YamatoRedeemer"], [Yamato.address], ["PledgeLib"]);

    YamatoSweeper = await getLinkedProxy<YamatoSweeper, YamatoSweeper__factory>(
      contractVersion["YamatoSweeper"],
      [Yamato.address],
      ["PledgeLib"]
    );

    Pool = await getProxy<Pool, Pool__factory>(contractVersion["Pool"], [
      Yamato.address,
    ]);

    PriorityRegistry = await getLinkedProxy<
      PriorityRegistry,
      PriorityRegistry__factory
    >(contractVersion["PriorityRegistry"], [Yamato.address], ["PledgeLib"]);

    YMT = await (<YMT__factory>await ethers.getContractFactory("YMT")).deploy();

    veYMT = await (<VeYMT__factory>(
      await ethers.getContractFactory("veYMT")
    )).deploy(YMT.address);

    ScoreWeightController = await getProxy<
      ScoreWeightController,
      ScoreWeightController__factory
    >(contractVersion["ScoreWeightController"], [YMT.address, veYMT.address]);

    YmtMinter = await getProxy<YmtMinter, YmtMinter__factory>(
      contractVersion["YmtMinter"],
      [YMT.address, ScoreWeightController.address]
    );

    ScoreRegistry = await getProxy<ScoreRegistry, ScoreRegistry__factory>(
      contractVersion["ScoreRegistry"],
      [YmtMinter.address, Yamato.address]
    );

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
    await (await Yamato.setScoreRegistory(ScoreRegistry.address)).wait();
    await (await CurrencyOS.addYamato(Yamato.address)).wait();
    await (await CJPY.setCurrencyOS(CurrencyOS.address)).wait();
  });

  beforeEach(async () => {
    snapshot = await takeSnapshot();
  });

  afterEach(async () => {
    await snapshot.restore();
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
