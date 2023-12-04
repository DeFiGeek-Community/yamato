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

chai.use(smock.matchers);

describe("ScoreRegistry checkpoint", function () {
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
  let scoreWeightController: ScoreWeightController;
  let pool: Pool;
  let priorityRegistry: PriorityRegistry;
  let PRICE: BigNumber;
  let accounts: SignerWithAddress[];
  let snapshot: SnapshotRestorer;
  const year = Constants.year;

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

    YMT = await (<YMT__factory>await ethers.getContractFactory("YMT")).deploy();

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

    PRICE = BigNumber.from(260000).mul(1e18 + "");

    // CJPY.balanceOf.returns(PRICE.mul(1).mul(100).div(MCR));
    mockFeed.fetchPrice.returns(PRICE);
    mockFeed.getPrice.returns(PRICE);
    mockFeed.lastGoodPrice.returns(PRICE);
  });

  beforeEach(async () => {
    snapshot = await takeSnapshot();
  });

  afterEach(async () => {
    await snapshot.restore();
  });

  it("test_user_checkpoint", async function () {
    // Assuming `userCheckpoint` is a function on your contract
    await scoreRegistry.connect(accounts[1]).userCheckpoint(accounts[1].address);
  });

  it("test_user_checkpoint_new_period", async function () {
    await scoreRegistry.connect(accounts[1]).userCheckpoint(accounts[1].address);

    // Increase the time on the blockchain
    await time.increase(year * 1.1);

    await scoreRegistry.connect(accounts[1]).userCheckpoint(accounts[1].address);
  });

  it("test_user_checkpoint_wrong_account", async function () {
    // Expect the transaction to be reverted with the specified error message
    await expect(
      scoreRegistry.connect(accounts[1]).userCheckpoint(accounts[2].address)
    ).to.be.revertedWith("dev: unauthorized");
  });
});
