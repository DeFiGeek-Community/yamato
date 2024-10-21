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

chai.use(smock.matchers);

const ten_to_the_18 = Constants.ten_to_the_18;
const ten_to_the_17 = Constants.ten_to_the_17;
const zero = Constants.zero;
const WEEK = Constants.WEEK;
const month = Constants.month;
const week = Constants.week;

describe("YmtMinter", function () {
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
  let accounts: SignerWithAddress[];
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

    PRICE = BigNumber.from(260000).mul(1e18 + "");

    mockFeed.fetchPrice.returns(PRICE);
    mockFeed.getPrice.returns(PRICE);
    mockFeed.lastGoodPrice.returns(PRICE);

    await scoreWeightController.addScore(
      scoreRegistry.address,
      ethers.utils.parseEther("10")
    );
    for (let i = 0; i < 4; i++) {
      await yamato
        .connect(accounts[i])
        .deposit({ value: ethers.utils.parseEther("100") });
    }
    await yamato.borrow(ethers.utils.parseEther("100000"));
  });

  beforeEach(async () => {
    snapshot = await takeSnapshot();
  });

  afterEach(async () => {
    await snapshot.restore();
  });

  describe("YmtMinter Behavior", function () {
    // 借入を行い、時間を進めた後にmintを実行
    it("Basic mint functionality test", async () => {
      await yamato.connect(accounts[1]).borrow(ten_to_the_17);

      await time.increase(month);

      await ymtMinter.connect(accounts[1]).mint(scoreRegistry.address); //scoreRegistry_address, msg.sender, mint
      let expected = await scoreRegistry.integrateFraction(accounts[1].address);

      expect(expected.gt(zero)).to.be.equal(true);
      expect(await YMT.balanceOf(accounts[1].address)).to.equal(expected);
      expect(
        await ymtMinter.minted(accounts[1].address, scoreRegistry.address)
      ).to.equal(expected);
    });

    // 借入を行い、時間を進めた後にmintを実行
    it("Mint immediately after setup", async () => {
      await yamato.connect(accounts[1]).borrow(ten_to_the_18);

      let t0 = BigNumber.from(await time.latest());
      let moment = t0.add(WEEK).div(WEEK).mul(WEEK).add("5");
      await time.setNextBlockTimestamp(moment);

      //mint
      expect(
        await ymtMinter.minted(accounts[1].address, scoreRegistry.address)
      ).to.equal("0");
      await ymtMinter.connect(accounts[1]).mint(scoreRegistry.address);

      //check
      let balance = await YMT.balanceOf(accounts[1].address);
      expect(
        await ymtMinter.minted(accounts[1].address, scoreRegistry.address)
      ).to.equal(balance);
    });

    // 同じscoreRegistryでの複数のmint操作をテスト
    it("Multiple mint operations on the same scoreRegistry", async () => {
      await yamato.connect(accounts[1]).borrow(ten_to_the_18);
      await time.increase(month);
      await ymtMinter.connect(accounts[1]).mint(scoreRegistry.address);
      let balance = await YMT.balanceOf(accounts[1].address);
      await time.increase(month);
      await ymtMinter.connect(accounts[1]).mint(scoreRegistry.address);
      let expected = await scoreRegistry.integrateFraction(accounts[1].address);
      let final_balance = await YMT.balanceOf(accounts[1].address);

      expect(final_balance.gt(balance)).to.be.equal(true); //2nd mint success
      expect(final_balance).to.equal(expected); //2nd mint works fine
      expect(
        await ymtMinter.minted(accounts[1].address, scoreRegistry.address)
      ).to.equal(expected); //tracks fine
    });

    // 引き出し後のmintをテスト
    it("Test minting after withdrawing", async () => {
      await yamato.connect(accounts[1]).borrow(ten_to_the_18);

      await time.increase(week * 2);
      const balance = await CJPY.connect(accounts[1]).balanceOf(
        accounts[1].address
      );
      await CJPY.transfer(accounts[1].address, ten_to_the_18.sub(balance));
      await yamato.connect(accounts[1]).repay(ten_to_the_18);
      await ymtMinter.connect(accounts[1]).mint(scoreRegistry.address);

      expect((await YMT.balanceOf(accounts[1].address)).gt(zero)).to.equal(
        true
      );
    });

    // 引き出し後の複数回のmintをテスト
    it("Test multiple mints after withdrawing", async () => {
      await yamato.connect(accounts[1]).borrow(ten_to_the_18);

      await time.increase(10);
      const CJPY_balance = await CJPY.connect(accounts[1]).balanceOf(
        accounts[1].address
      );
      await CJPY.transfer(accounts[1].address, ten_to_the_18.sub(CJPY_balance));
      await yamato.connect(accounts[1]).repay(ten_to_the_18);
      await ymtMinter.connect(accounts[1]).mint(scoreRegistry.address);

      let balance = await YMT.balanceOf(accounts[1].address);

      await time.increase(10);
      await ymtMinter.connect(accounts[1]).mint(scoreRegistry.address);

      expect(await YMT.balanceOf(accounts[1].address)).to.equal(balance);
    });

    // 預金なしでのmintをテスト
    it("Test mint without any deposit", async () => {
      await ymtMinter.connect(accounts[1]).mint(scoreRegistry.address);
      expect(await YMT.balanceOf(accounts[1].address)).to.equal(zero);
      expect(
        await ymtMinter.minted(accounts[1].address, scoreRegistry.address)
      ).to.equal(zero);
    });

    // 無効なscoreRegistryアドレスでのmintをテスト
    it("Test minting with an invalid scoreRegistry address", async () => {
      await expect(ymtMinter.mint(accounts[1].address)).to.revertedWith(
        "dev: score is not added"
      );
    });

    // インフレ開始前のmintをテスト
    it("Test minting before inflation begins", async () => {
      await yamato.connect(accounts[1]).borrow(ten_to_the_18);
      const startEpochTime = await YMT.startEpochTime();
      const currentTime = await time.latest();
      const timeToSleep = startEpochTime.sub(currentTime).sub(5);

      // 時間を戻す
      await ethers.provider.send("evm_increaseTime", [timeToSleep.toNumber()]);
      await ethers.provider.send("evm_mine", []);

      await ymtMinter.connect(accounts[1]).mint(scoreRegistry.address);

      expect(await YMT.balanceOf(accounts[1].address)).to.equal(zero);
      expect(
        await ymtMinter.minted(accounts[1].address, scoreRegistry.address)
      ).to.equal(zero);
    });

    // mint承認関数のトグルをテスト
    it("Test toggling of the mint approval function", async () => {
      await ymtMinter
        .connect(accounts[1])
        .toggleApproveMint(accounts[2].address);
      expect(
        await ymtMinter.allowedToMintFor(
          accounts[2].address,
          accounts[1].address
        )
      ).to.equal(true);

      await ymtMinter
        .connect(accounts[1])
        .toggleApproveMint(accounts[2].address);
      expect(
        await ymtMinter.allowedToMintFor(
          accounts[2].address,
          accounts[1].address
        )
      ).to.equal(false);
    });

    // 他のユーザーのためにmintを行う関数をテスト
    it("Test minting on behalf of another user", async () => {
      await yamato.connect(accounts[1]).borrow(ten_to_the_17);

      await time.increase(month);

      await ymtMinter
        .connect(accounts[1])
        .toggleApproveMint(accounts[2].address);
      expect(
        await ymtMinter.allowedToMintFor(
          accounts[2].address,
          accounts[1].address
        )
      ).to.equal(true);

      await ymtMinter
        .connect(accounts[2])
        .mintFor(scoreRegistry.address, accounts[1].address);

      let expected = await scoreRegistry.integrateFraction(accounts[1].address);
      expect(expected.gt(zero)).to.be.equal(true);
      expect(await YMT.balanceOf(accounts[1].address)).to.equal(expected);
      expect(
        await ymtMinter.minted(accounts[1].address, scoreRegistry.address)
      ).to.equal(expected);
    });

    // 承認なしでのmintFor関数をテスト
    it("Test mintFor function when not approved", async () => {
      await yamato.connect(accounts[1]).borrow(ten_to_the_17);

      await time.increase(month);

      expect(
        await ymtMinter.allowedToMintFor(
          accounts[2].address,
          accounts[1].address
        )
      ).to.equal(false);

      await ymtMinter
        .connect(accounts[2])
        .mintFor(scoreRegistry.address, accounts[1].address);

      expect(await YMT.balanceOf(accounts[1].address)).to.equal(0);
      expect(
        await ymtMinter.minted(accounts[1].address, scoreRegistry.address)
      ).to.equal(0);
    });
  });
});
