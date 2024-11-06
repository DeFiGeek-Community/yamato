import { FakeContract, smock } from "@defi-wonderland/smock";
import chai, { expect } from "chai";
import { ethers } from "hardhat";
import { BigNumber } from "ethers";
import {
  time,
  takeSnapshot,
  SnapshotRestorer,
} from "@nomicfoundation/hardhat-network-helpers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import {
  CJPY,
  CJPY__factory,
  CUSD,
  CUSD__factory,
  ChainLinkMock,
  ChainLinkMock__factory,
  CurrencyOSV3,
  CurrencyOSV3__factory,
  CurrencyOSV4,
  CurrencyOSV4__factory,
  Pool,
  Pool__factory,
  FeePoolV2,
  FeePoolV2__factory,
  PriceFeed,
  PriceFeed__factory,
  PriceFeedSingle,
  PriceFeedSingle__factory,
  PriorityRegistry,
  PriorityRegistry__factory,
  YmtOS,
  YmtOS__factory,
  YamatoV4,
  YamatoDepositor,
  YamatoBorrower,
  YamatoRepayer,
  YamatoWithdrawer,
  YamatoRedeemer,
  YamatoSweeper,
  YmtVesting,
  YMT,
  VeYMT,
  ScoreWeightController,
  ScoreWeightController__factory,
  ScoreWeightControllerV2,
  ScoreWeightControllerV2__factory,
  YmtMinter,
  ScoreRegistry,
  YamatoV4__factory,
  YamatoDepositor__factory,
  YamatoBorrower__factory,
  YamatoRepayer__factory,
  YamatoWithdrawer__factory,
  YamatoRedeemer__factory,
  YamatoSweeper__factory,
  YmtVesting__factory,
  YMT__factory,
  VeYMT__factory,
  YmtMinter__factory,
  ScoreRegistry__factory,
} from "../../typechain";
import { getFakeProxy, getProxy, getLinkedProxy } from "../../src/testUtil";
import { upgradeProxy } from "../../src/upgradeUtil";
import { toERC20 } from "../param/helper";
import { contractVersion } from "../param/version";

chai.use(smock.matchers);

const week = 86400 * 7;
const month = 86400 * 30;
const year = 86400 * 365;
const ten_to_the_18 = ethers.utils.parseEther("1");

describe.only("YamatoV2", function () {
  let ChainLinkEthUsd: ChainLinkMock;
  let ChainLinkUsdJpy: ChainLinkMock;
  let PriceFeed: PriceFeed;
  let PriceFeedV2: PriceFeedSingle;
  let FeePool: FeePoolV2;
  let CJPY: CJPY;
  let CUSD: CUSD;
  let currencyOS: CurrencyOSV3;
  let currencyOSCJPY: CurrencyOSV4;
  let yamato: YamatoV4;
  let yamatoDepositor: YamatoDepositor;
  let yamatoBorrower: YamatoBorrower;
  let yamatoRepayer: YamatoRepayer;
  let yamatoWithdrawer: YamatoWithdrawer;
  let yamatoRedeemer: YamatoRedeemer;
  let yamatoSweeper: YamatoSweeper;
  let scoreRegistry: ScoreRegistry;
  let priorityRegistry: PriorityRegistry;
  let pool: Pool;
  let currencyOSCUSD: CurrencyOSV4;
  let yamatoV2: YamatoV4;
  let yamatoDepositorV2: YamatoDepositor;
  let yamatoBorrowerV2: YamatoBorrower;
  let yamatoRepayerV2: YamatoRepayer;
  let yamatoWithdrawerV2: YamatoWithdrawer;
  let yamatoRedeemerV2: YamatoRedeemer;
  let yamatoSweeperV2: YamatoSweeper;
  let scoreRegistryV2: ScoreRegistry;
  let priorityRegistryV2: PriorityRegistry;
  let poolV2: Pool;
  let ymtMinter: YmtMinter;
  let veYMT: VeYMT;
  let YMT: YMT;
  let YmtVesting: YmtVesting;
  let scoreWeightController: ScoreWeightController;
  let scoreWeightControllerV2: ScoreWeightControllerV2;
  let YmtOS: YmtOS;
  let PRICE_USDETH: BigNumber;
  let PRICE_JPYUSD: BigNumber;
  let COMPOSITE_PRICE: BigNumber;
  let accounts: SignerWithAddress[];
  let snapshot: SnapshotRestorer;
  let startTimeV1: BigNumber;

  before(async () => {
    await time.increase(week * 10);
    accounts = await ethers.getSigners();

    PRICE_USDETH = BigNumber.from(260000).mul(1e18 + "");
    PRICE_JPYUSD = BigNumber.from(6).mul(1e15 + ""); // 0.006 * 1e18 = 6 * 1e15
    COMPOSITE_PRICE = PRICE_USDETH.mul(PRICE_JPYUSD).div(
      BigNumber.from(1e18 + "")
    );

    ChainLinkEthUsd = await (<ChainLinkMock__factory>(
      await ethers.getContractFactory("ChainLinkMock")
    )).deploy("ETH/USD");
    ChainLinkUsdJpy = await (<ChainLinkMock__factory>(
      await ethers.getContractFactory("ChainLinkMock")
    )).deploy("JPY/USD");
    FeePool = await getProxy<FeePoolV2, FeePoolV2__factory>("FeePool", [], 1);
    FeePool = await upgradeProxy(FeePool.address, "FeePoolV2", undefined, {
      call: { fn: "initializeV2", args: [await time.latest()] },
    });
    PriceFeed = await getProxy<PriceFeed, PriceFeed__factory>(
      contractVersion["PriceFeed"],
      [ChainLinkEthUsd.address, ChainLinkUsdJpy.address]
    );
    CJPY = await (<CJPY__factory>(
      await ethers.getContractFactory("CJPY")
    )).deploy();
    currencyOS = await getProxy<CurrencyOSV3, CurrencyOSV3__factory>(
      contractVersion["CurrencyOS"],
      [CJPY.address, PriceFeed.address, FeePool.address]
    );

    yamato = await getLinkedProxy<YamatoV4, YamatoV4__factory>(
      contractVersion["Yamato"],
      [currencyOS.address],
      ["PledgeLib"]
    );

    await currencyOS.addYamato(yamato.address);
    await CJPY.setCurrencyOS(currencyOS.address);

    yamatoDepositor = await getLinkedProxy<
      YamatoDepositor,
      YamatoDepositor__factory
    >(contractVersion["YamatoDepositor"], [yamato.address], ["PledgeLib"]);

    yamatoBorrower = await getLinkedProxy<
      YamatoBorrower,
      YamatoBorrower__factory
    >(contractVersion["YamatoBorrower"], [yamato.address], ["PledgeLib"]);

    yamatoRepayer = await getLinkedProxy<YamatoRepayer, YamatoRepayer__factory>(
      contractVersion["YamatoRepayer"],
      [yamato.address],
      ["PledgeLib"]
    );

    yamatoWithdrawer = await getLinkedProxy<
      YamatoWithdrawer,
      YamatoWithdrawer__factory
    >(contractVersion["YamatoWithdrawer"], [yamato.address], ["PledgeLib"]);

    yamatoRedeemer = await getLinkedProxy<
      YamatoRedeemer,
      YamatoRedeemer__factory
    >(contractVersion["YamatoRedeemer"], [yamato.address], ["PledgeLib"]);

    yamatoSweeper = await getLinkedProxy<YamatoSweeper, YamatoSweeper__factory>(
      contractVersion["YamatoSweeper"],
      [yamato.address],
      ["PledgeLib"]
    );

    priorityRegistry = await getLinkedProxy<
      PriorityRegistry,
      PriorityRegistry__factory
    >(contractVersion["PriorityRegistry"], [yamato.address], ["PledgeLib"]);

    YmtVesting = await (<YmtVesting__factory>(
      await ethers.getContractFactory("YmtVesting")
    )).deploy();

    YMT = await (<YMT__factory>await ethers.getContractFactory("YMT")).deploy(
      YmtVesting.address,
      accounts[0].address
    );

    veYMT = await (<VeYMT__factory>(
      await ethers.getContractFactory("veYMT")
    )).deploy(YMT.address);

    scoreWeightController = await getProxy<
      ScoreWeightController,
      ScoreWeightController__factory
    >(contractVersion["ScoreWeightController"], [YMT.address, veYMT.address]);

    ymtMinter = await getProxy<YmtMinter, YmtMinter__factory>(
      contractVersion["YmtMinter"],
      [YMT.address, scoreWeightController.address]
    );

    scoreRegistry = await getLinkedProxy<ScoreRegistry, ScoreRegistry__factory>(
      contractVersion["ScoreRegistry"],
      [ymtMinter.address, yamato.address],
      ["PledgeLib"]
    );

    pool = await getProxy<Pool, Pool__factory>(contractVersion["Pool"], [
      yamato.address,
    ]);

    await (
      await yamato.setDeps(
        yamatoDepositor.address,
        yamatoBorrower.address,
        yamatoRepayer.address,
        yamatoWithdrawer.address,
        yamatoRedeemer.address,
        yamatoSweeper.address,
        pool.address,
        priorityRegistry.address
      )
    ).wait();
    await (await yamato.setScoreRegistry(scoreRegistry.address)).wait();
    await YmtVesting.setYmtToken(YMT.address);
    await YMT.setMinter(ymtMinter.address);
    await currencyOS.setYMT(YMT.address);
    await currencyOS.setVeYMT(veYMT.address);
    await currencyOS.setYmtMinter(ymtMinter.address);
    await currencyOS.setScoreWeightController(scoreWeightController.address);
    await FeePool.setVeYMT(veYMT.address);
    await scoreWeightController.addScore(scoreRegistry.address, ten_to_the_18);

    await time.increase(week * 4 * 3);

    await (await ChainLinkEthUsd.setLastPrice(PRICE_USDETH)).wait(); //dec8
    await (await ChainLinkUsdJpy.setLastPrice(PRICE_JPYUSD)).wait(); //dec8

    YmtOS = await getProxy<YmtOS, YmtOS__factory>("YmtOS", [
      currencyOS.address,
    ]);

    PriceFeedV2 = await getProxy<PriceFeedSingle, PriceFeedSingle__factory>(
      "PriceFeedSingle",
      [ChainLinkEthUsd.address]
    );
    CUSD = await (<CUSD__factory>(
      await ethers.getContractFactory("CUSD")
    )).deploy();

    currencyOSCUSD = await getProxy<CurrencyOSV4, CurrencyOSV4__factory>(
      "CurrencyOSV4",
      [CUSD.address, PriceFeedV2.address, FeePool.address]
    );

    yamatoV2 = await getLinkedProxy<YamatoV4, YamatoV4__factory>(
      contractVersion["Yamato"],
      [currencyOSCUSD.address],
      ["PledgeLib"]
    );

    await currencyOSCUSD.addYamato(yamatoV2.address);
    await CUSD.setCurrencyOS(currencyOSCUSD.address);

    yamatoDepositorV2 = await getLinkedProxy<
      YamatoDepositor,
      YamatoDepositor__factory
    >(contractVersion["YamatoDepositor"], [yamatoV2.address], ["PledgeLib"]);

    yamatoBorrowerV2 = await getLinkedProxy<
      YamatoBorrower,
      YamatoBorrower__factory
    >(contractVersion["YamatoBorrower"], [yamatoV2.address], ["PledgeLib"]);

    yamatoRepayerV2 = await getLinkedProxy<
      YamatoRepayer,
      YamatoRepayer__factory
    >(contractVersion["YamatoRepayer"], [yamatoV2.address], ["PledgeLib"]);

    yamatoWithdrawerV2 = await getLinkedProxy<
      YamatoWithdrawer,
      YamatoWithdrawer__factory
    >(contractVersion["YamatoWithdrawer"], [yamatoV2.address], ["PledgeLib"]);

    yamatoRedeemerV2 = await getLinkedProxy<
      YamatoRedeemer,
      YamatoRedeemer__factory
    >(contractVersion["YamatoRedeemer"], [yamatoV2.address], ["PledgeLib"]);

    yamatoSweeperV2 = await getLinkedProxy<
      YamatoSweeper,
      YamatoSweeper__factory
    >(contractVersion["YamatoSweeper"], [yamatoV2.address], ["PledgeLib"]);

    priorityRegistryV2 = await getLinkedProxy<
      PriorityRegistry,
      PriorityRegistry__factory
    >(contractVersion["PriorityRegistry"], [yamatoV2.address], ["PledgeLib"]);

    poolV2 = await getProxy<Pool, Pool__factory>(contractVersion["Pool"], [
      yamatoV2.address,
    ]);

    scoreRegistryV2 = await getLinkedProxy<
      ScoreRegistry,
      ScoreRegistry__factory
    >(
      contractVersion["ScoreRegistry"],
      [ymtMinter.address, yamatoV2.address],
      ["PledgeLib"]
    );

    await (
      await yamatoV2.setDeps(
        yamatoDepositorV2.address,
        yamatoBorrowerV2.address,
        yamatoRepayerV2.address,
        yamatoWithdrawerV2.address,
        yamatoRedeemerV2.address,
        yamatoSweeperV2.address,
        poolV2.address,
        priorityRegistryV2.address
      )
    ).wait();
    await (await yamatoV2.setScoreRegistry(scoreRegistryV2.address)).wait();

    currencyOSCJPY = await upgradeProxy<CurrencyOSV4, CurrencyOSV4__factory>(
      currencyOS.address,
      "CurrencyOSV4",
      undefined
    );
    startTimeV1 = await scoreRegistry.periodTimestamp(0);
    console.log("startTimeV1",Number(startTimeV1))
    scoreWeightControllerV2 = await upgradeProxy<
      ScoreWeightControllerV2,
      ScoreWeightControllerV2__factory
    >(scoreWeightController.address, "ScoreWeightControllerV2", undefined, {
      call: { fn: "initializeV2", args: [scoreRegistry.address, startTimeV1 ] },
    });
    await currencyOSCJPY.setYmtOS(YmtOS.address);
    await currencyOSCUSD.setYmtOS(YmtOS.address);
    await YmtOS.addCurrencyOS(currencyOSCUSD.address);
    await scoreWeightControllerV2.addScore(
      scoreRegistryV2.address,
      ten_to_the_18
    );

    const amount = ten_to_the_18.mul(100000);
    await YMT.approve(veYMT.address, amount);
    YMT.transfer(accounts[1].address, amount);
    await YMT.connect(accounts[1]).approve(veYMT.address, amount);
    await veYMT.createLock(amount, (await time.latest()) + year * 4);
    await veYMT
      .connect(accounts[1])
      .createLock(amount, (await time.latest()) + week * 100);
    await scoreWeightControllerV2.voteForScoreWeights(
      scoreRegistry.address,
      5000
    );
    await time.increase(week * 10);



    await (await ChainLinkEthUsd.setLastPrice(PRICE_USDETH)).wait(); //dec8
    await (await ChainLinkUsdJpy.setLastPrice(PRICE_JPYUSD)).wait(); //dec8

    console.log("v2DeploymentTime", Number(await scoreWeightControllerV2.v2DeploymentTime()));
  });

  beforeEach(async () => {
    snapshot = await takeSnapshot();
  });

  afterEach(async () => {
    await snapshot.restore();
  });

  it("should increase CJPY and CUSD balances after borrowing", async function () {
    const toCollateralize = 1;
    const MCR = BigNumber.from(130);

    const initialCJPYBalance = await CJPY.balanceOf(accounts[0].address);
    const initialCUSDBalance = await CUSD.balanceOf(accounts[0].address);

    const toBorrow = COMPOSITE_PRICE.mul(toCollateralize)
      .mul(100)
      .div(MCR)
      .div(1e18 + "");
    await yamato.deposit({ value: toERC20(toCollateralize + "") });
    await yamato.borrow(toERC20(toBorrow + ""));

    const toBorrowV2 = PRICE_USDETH.mul(toCollateralize)
      .mul(100)
      .div(MCR)
      .div(1e18 + "");
    await yamatoV2.deposit({ value: toERC20(toCollateralize + "") });
    await yamatoV2.borrow(toERC20(toBorrowV2 + ""));

    const [totalColl, totalDebt] = await yamato.getStates();
    expect(totalDebt).to.be.gt(0);
    const [totalCollV2, totalDebtV2] = await yamatoV2.getStates();
    expect(totalDebtV2).to.be.gt(0);

    // CJPYとCUSDの残高を取得
    const beforeCJPYBalance = await CJPY.balanceOf(accounts[0].address);
    const beforeCUSDBalance = await CUSD.balanceOf(accounts[0].address);

    expect(beforeCJPYBalance).to.be.gt(initialCJPYBalance);
    expect(beforeCUSDBalance).to.be.gt(initialCUSDBalance);
  });

  it("should decrease mint amount for scoreRegistryV2 after voting in ScoreWeightControllerV2", async function () {
    const toCollateralize = 1;
    const MCR = BigNumber.from(130);

    const toBorrow = COMPOSITE_PRICE.mul(toCollateralize)
      .mul(100)
      .div(MCR)
      .div(1e18 + "");
    await yamato.deposit({ value: toERC20(toCollateralize + "") });
    await yamato.borrow(toERC20(toBorrow + ""));

    const toBorrowV2 = PRICE_USDETH.mul(toCollateralize)
      .mul(100)
      .div(MCR)
      .div(1e18 + "");
    await yamatoV2.deposit({ value: toERC20(toCollateralize + "") });
    await yamatoV2.borrow(toERC20(toBorrowV2 + ""));

    console.log(Number(await scoreWeightControllerV2.voteUserPower(accounts[0].address)));
    await scoreWeightControllerV2.voteForScoreWeights(
      scoreRegistryV2.address,
      5000
    );

    const timeTotal = await scoreWeightControllerV2.timeTotal();

    for (let i = 0; i < 12; i++) {
      const time = (Number(timeTotal) + (month)) - (i * month);
      console.log("===================");
      console.log(time);
      console.log(Number(await scoreWeightControllerV2.pointsTotal(time)))
      console.log(Number(await scoreWeightControllerV2.scoreRelativeWeight(scoreRegistry.address, time)))
      console.log(Number(await scoreWeightControllerV2.scoreRelativeWeight(scoreRegistryV2.address, time)))
    }



    // YMTの残高を取得
    const initialYMTBalance = await YMT.balanceOf(accounts[0].address);

    // スコアレジストリに対してミント
    await (await ymtMinter.mint(scoreRegistry.address)).wait();
    const postMintYMTBalance = await YMT.balanceOf(accounts[0].address);

    // スコアレジストリV2に対してミント
    await (await ymtMinter.mint(scoreRegistryV2.address)).wait();
    const finalYMTBalance = await YMT.balanceOf(accounts[0].address);

    const MintAmount1 = postMintYMTBalance.sub(initialYMTBalance);
    const MintAmount2 = finalYMTBalance.sub(postMintYMTBalance);

    console.log(Number(MintAmount1));
    console.log(Number(MintAmount2));
    expect(MintAmount1).to.be.gt(MintAmount2);

    // 残高が増えていることを確認
    expect(postMintYMTBalance).to.be.gt(initialYMTBalance);
    expect(finalYMTBalance).to.be.gt(postMintYMTBalance);
  });

  it("should verify the addresses of currencyOSCJPY, currencyOSCUSD, and YmtOS", async function () {
    expect(await currencyOSCJPY.currency()).to.equal(CJPY.address);
    expect(await currencyOSCJPY.priceFeed()).to.equal(PriceFeed.address);
    expect(await currencyOSCJPY.feePool()).to.equal(FeePool.address);
    expect(await currencyOSCJPY.YMT()).to.equal(YMT.address);
    expect(await currencyOSCJPY.veYMT()).to.equal(veYMT.address);
    expect(await currencyOSCJPY.ymtMinter()).to.equal(ymtMinter.address);
    expect(await currencyOSCJPY.scoreWeightController()).to.equal(
      scoreWeightControllerV2.address
    );
    expect(await currencyOSCJPY.ymtOS()).to.equal(YmtOS.address);
    expect(await currencyOSCUSD.currency()).to.equal(CUSD.address);
    expect(await currencyOSCUSD.priceFeed()).to.equal(PriceFeedV2.address);
    expect(await currencyOSCUSD.feePool()).to.equal(FeePool.address);
    expect(await currencyOSCUSD.YMT()).to.equal(YMT.address);
    expect(await currencyOSCUSD.veYMT()).to.equal(veYMT.address);
    expect(await currencyOSCUSD.ymtMinter()).to.equal(ymtMinter.address);
    expect(await currencyOSCUSD.scoreWeightController()).to.equal(
      scoreWeightControllerV2.address
    );
    expect(await currencyOSCUSD.ymtOS()).to.equal(YmtOS.address);
    expect(await YmtOS.YMT()).to.equal(YMT.address);
    expect(await YmtOS.veYMT()).to.equal(veYMT.address);
    expect(await YmtOS.ymtMinter()).to.equal(ymtMinter.address);
    expect(await YmtOS.scoreWeightController()).to.equal(
      scoreWeightControllerV2.address
    );
  });
});
