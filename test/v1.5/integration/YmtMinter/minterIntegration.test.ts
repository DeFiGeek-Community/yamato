import { expect } from "chai";
import { ethers } from "hardhat";
import { BigNumber } from "ethers";
import {
  time,
  takeSnapshot,
  SnapshotRestorer,
} from "@nomicfoundation/hardhat-network-helpers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { FakeContract } from "@defi-wonderland/smock";
import {
  CJPY,
  CurrencyOSV3,
  Pool,
  FeePool,
  PriceFeedV3,
  PriorityRegistry,
  PriorityRegistry__factory,
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
  YmtMinter,
  ScoreRegistry,
  CJPY__factory,
  CurrencyOSV3__factory,
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
  ScoreWeightController__factory,
  YmtMinter__factory,
  ScoreRegistry__factory,
  Pool__factory,
} from "../../../../typechain";
import {
  getFakeProxy,
  getProxy,
  getLinkedProxy,
} from "../../../../src/testUtil";
import { contractVersion } from "../../../param/version";
import Constants from "../../Constants";

const week = Constants.week;
const month = Constants.month;
const ten_to_the_18 = Constants.ten_to_the_18;

describe("YmtMinter integration", function () {
  let accounts: SignerWithAddress[];
  let mockFeePool: FakeContract<FeePool>;
  let mockFeed: FakeContract<PriceFeedV3>;
  let CJPY: CJPY;
  let currencyOS: CurrencyOSV3;
  let yamato: YamatoV4;
  let yamatoDepositor: YamatoDepositor;
  let yamatoBorrower: YamatoBorrower;
  let yamatoRepayer: YamatoRepayer;
  let yamatoWithdrawer: YamatoWithdrawer;
  let yamatoRedeemer: YamatoRedeemer;
  let yamatoSweeper: YamatoSweeper;
  let scoreRegistry: ScoreRegistry;
  let ymtMinter: YmtMinter;
  let veYMT: VeYMT;
  let YMT: YMT;
  let YmtVesting: YmtVesting;
  let scoreWeightController: ScoreWeightController;
  let pool: Pool;
  let priorityRegistry: PriorityRegistry;
  let PRICE: BigNumber;
  let snapshot: SnapshotRestorer;

  before(async function () {
    accounts = await ethers.getSigners();
    mockFeePool = await getFakeProxy<FeePool>(contractVersion["FeePool"]);
    mockFeed = await getFakeProxy<PriceFeedV3>(contractVersion["PriceFeed"]);
    CJPY = await (<CJPY__factory>(
      await ethers.getContractFactory("CJPY")
    )).deploy();
    currencyOS = await getProxy<CurrencyOSV3, CurrencyOSV3__factory>(
      contractVersion["CurrencyOS"],
      [CJPY.address, mockFeed.address, mockFeePool.address]
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

    await currencyOS.setYmtMinter(ymtMinter.address);
    await YMT.setMinter(ymtMinter.address);

    PRICE = BigNumber.from(200000).mul(1e18 + "");

    mockFeed.fetchPrice.returns(PRICE);
    mockFeed.getPrice.returns(PRICE);
    mockFeed.lastGoodPrice.returns(PRICE);

    await yamato.deposit({ value: ethers.utils.parseEther("100") });
    await yamato.borrow(ethers.utils.parseEther("100000"));
    for (let i = 0; i < 5; i++) {
      await CJPY.transfer(
        accounts[i + 1].address,
        ethers.utils.parseEther("10000")
      );
    }
    await scoreWeightController.addScore(scoreRegistry.address, ten_to_the_18);
  });

  beforeEach(async () => {
    snapshot = await takeSnapshot();
  });

  afterEach(async () => {
    await snapshot.restore();
  });

  function getICR(pledge, price) {
    const { coll, debt } = pledge;
    const collInCurrency = coll.mul(price).div(ten_to_the_18);
    return BigNumber.from("10000").mul(collInCurrency).div(debt);
  }

  function calculateCoefficient(collateralRatio) {
    if (collateralRatio >= 25000) return BigNumber.from("25");
    if (collateralRatio >= 20000) return BigNumber.from("20");
    if (collateralRatio >= 15000) return BigNumber.from("15");
    if (collateralRatio >= 13000) return BigNumber.from("10");
    return BigNumber.from("0");
  }

  function approxEqual(actual, expected, tolerance) {
    // 差の絶対値を計算
    const diff = actual.sub(expected).abs();

    // 差が許容誤差以下であるかどうかを確認
    return diff.lte(tolerance);
  }

  // 担保比率をテストする
  it(`should test the mint collateral ratio`, async function () {
    const amount = "100000";
    await YMT.setMinter(ymtMinter.address);
    const ethAmounts = ["1.5", "1.25", "1", "0.75", "0.65"];
    for (let i = 0; i < 5; i++) {
      await yamato
        .connect(accounts[i + 1])
        .deposit({ value: ethers.utils.parseEther(ethAmounts[i]) });
    }

    // For weights to activate
    await time.increase(week);

    // Bob and Charlie deposit to gauges with different weights
    for (let i = 0; i < 5; i++) {
      await yamato
        .connect(accounts[i + 1])
        .borrow(ethers.utils.parseEther(amount));
    }
    // mockFeed.fetchPrice.returns(PRICE = BigNumber.from(180000).mul(1e18 + ""));
    await time.increase(month);

    const ICRs = [];
    for (let i = 0; i < 5; i++) {
      const pledge = await yamato.getPledge(accounts[i + 1].address);
      ICRs.push(Number(getICR(pledge, PRICE)));
      await yamato
        .connect(accounts[i + 1])
        .repay(ethers.utils.parseEther(amount));
    }

    // Claim for Bob now
    await ymtMinter.connect(accounts[1]).mint(scoreRegistry.address);
    const bobTokens = await YMT.balanceOf(accounts[1].address);
    await time.increase(month);

    // This won't give anything
    await ymtMinter.connect(accounts[1]).mint(scoreRegistry.address);
    expect(await YMT.balanceOf(accounts[1].address)).to.equal(bobTokens);

    let tokens = [];
    for (let i = 0; i < 5; i++) {
      await ymtMinter.connect(accounts[i + 1]).mint(scoreRegistry.address);
      const token = await YMT.balanceOf(accounts[i + 1].address);
      // console.log("tokenBalance:", Number(token));
      tokens.push(token);
    }
    for (let i = 0; i < 5; i++) {
      const ratio = calculateCoefficient(ICRs[i]);
      expect(
        approxEqual(
          tokens[i],
          tokens[4].mul(ratio).div(BigNumber.from("10")),
          BigNumber.from(10).pow(19)
        )
      ).to.be.true;
    }
  });
});
