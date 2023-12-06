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
  let scoreWeightController: ScoreWeightController;
  let pool: Pool;
  let priorityRegistry: PriorityRegistry;
  let PRICE: BigNumber;
  let accounts: SignerWithAddress[];
  let ownerAddress: string;
  let snapshot: SnapshotRestorer;

  before(async function () {
    accounts = await ethers.getSigners();
    ownerAddress = await accounts[0].getAddress();

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

    await scoreWeightController.addCurrency(
      scoreRegistry.address,
      ethers.utils.parseEther("10")
    );
    for (let i = 0; i < 4; i++) {
      await yamato
        .connect(accounts[i])
        .deposit({ value: ethers.utils.parseEther("100") });
    }
    await yamato.borrow(ethers.utils.parseEther("100000"));
  
    // for (const account of accounts) {
    //   mockLpToken.transfer(account.address, ten_to_the_18);
    // }
    // for (let i = 1; i <= 3; i++) {
    //   for (const gauge of threeScoreRegistry) {
    //     await mockLpToken.connect(accounts[i]).approve(gauge, ten_to_the_18);
    //   }
    // }
  });

  beforeEach(async () => {
    snapshot = await takeSnapshot();
  });

  afterEach(async () => {
    await snapshot.restore();
  });

  describe("YmtMinter Behavior", function () {
    // Test basic mint functionality
    it("test_mint", async () => {
      await yamato
        .connect(accounts[1])
        .borrow(ten_to_the_17);

      await time.increase(month);

      await ymtMinter.connect(accounts[1]).mint(scoreRegistry.address); //gauge_address, msg.sender, mint
      let expected = await scoreRegistry.integrateFraction(accounts[1].address);

      expect(expected.gt(BigNumber.from("0"))).to.be.equal(true);
      expect(await YMT.balanceOf(accounts[1].address)).to.equal(expected);
      expect(
        await ymtMinter.minted(accounts[1].address, scoreRegistry.address)
      ).to.equal(expected);
    });

    // Test minting immediately after setup
    it("test_mint_immediate", async () => {
      await yamato
        .connect(accounts[1])
        .borrow(ten_to_the_18);

      let t0 = BigNumber.from(
        (await ethers.provider.getBlock("latest")).timestamp
      );
      let moment = t0.add(WEEK).div(WEEK).mul(WEEK).add("5");
      await ethers.provider.send("evm_setNextBlockTimestamp", [
        moment.toNumber(),
      ]);

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

    // Test multiple mint operations on the same gauge
    it("test_mint_multiple_same_gauge", async () => {
      await yamato
        .connect(accounts[1])
        .borrow(ten_to_the_18);
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

    // Test minting across multiple gauges
    it("test_mint_multiple_gauges", async () => {
      //setup
      await yamato
        .connect(accounts[1])
        .borrow(ten_to_the_17);

      await time.increase(month);


      await ymtMinter.connect(accounts[1]).mint(scoreRegistry.address);

      let minted = await ymtMinter.minted(accounts[1].address, scoreRegistry.address);
      expect(minted).to.equal(
        await scoreRegistry.integrateFraction(accounts[1].address)
      );
    });

    // Test minting after withdrawing
    it("test_mint_after_withdraw", async () => {
      await yamato
        .connect(accounts[1])
        .borrow(ten_to_the_18);

      await time.increase(week * 2);
      const balance = await CJPY.connect(accounts[1]).balanceOf(accounts[1].address);
      await CJPY.transfer(accounts[1].address, ten_to_the_18.sub(balance));
      await yamato.connect(accounts[1]).repay(ten_to_the_18);
      await ymtMinter.connect(accounts[1]).mint(scoreRegistry.address);

      expect(
        (await YMT.balanceOf(accounts[1].address)).gt(BigNumber.from("0"))
      ).to.equal(true);
    });

    // Test multiple mints after withdrawing
    it("test_mint_multiple_after_withdraw", async () => {
      await yamato
        .connect(accounts[1])
        .borrow(ten_to_the_18);

      await time.increase(10);
      const CJPY_balance = await CJPY.connect(accounts[1]).balanceOf(accounts[1].address);
      await CJPY.transfer(accounts[1].address, ten_to_the_18.sub(CJPY_balance));
      await yamato.connect(accounts[1]).repay(ten_to_the_18);
      await ymtMinter.connect(accounts[1]).mint(scoreRegistry.address);

      let balance = await YMT.balanceOf(accounts[1].address);

      await time.increase(10);
      await ymtMinter.connect(accounts[1]).mint(scoreRegistry.address);

      expect(await YMT.balanceOf(accounts[1].address)).to.equal(balance);
    });

    // Test mint without any deposit
    it("test_no_deposit", async () => {
      await ymtMinter.connect(accounts[1]).mint(scoreRegistry.address);
      expect(await YMT.balanceOf(accounts[1].address)).to.equal(zero);
      expect(
        await ymtMinter.minted(accounts[1].address, scoreRegistry.address)
      ).to.equal(zero);
    });

    // Test minting with an invalid gauge address
    it("test_mint_not_a_gauge", async () => {
      await expect(ymtMinter.mint(accounts[1].address)).to.revertedWith(
        "dev: score is not added"
      );
    });

    // Test minting before inflation begins
    it("test_mint_before_inflation_begins", async function () {
      await yamato
        .connect(accounts[1])
        .borrow(ten_to_the_18);
      const startEpochTime = await YMT.startEpochTime();
      const currentTime = await time.latest();

      const timeToSleep = startEpochTime.sub(currentTime).sub(5);
      await ethers.provider.send("evm_increaseTime", [timeToSleep.toNumber()]);

      await ymtMinter.connect(accounts[1]).mint(scoreRegistry.address);

      expect(await YMT.balanceOf(accounts[1].address)).to.equal(
        BigNumber.from(0)
      );
      expect(
        await ymtMinter.minted(accounts[1].address, scoreRegistry.address)
      ).to.equal(BigNumber.from(0));
    });

    // Test mintMany function with multiple gauges
    // it("test_mintMany_function_multiple_gauges", async () => {
    //   //setup
    //   await scoreRegistry
    //     .connect(accounts[1])
    //     .deposit(ten_to_the_17, accounts[1].address, false);
    //   await gauges[1]
    //     .connect(accounts[1])
    //     .deposit(ten_to_the_17, accounts[1].address, false);
    //   await gauges[2]
    //     .connect(accounts[1])
    //     .deposit(ten_to_the_17, accounts[1].address, false);

    //   await time.increase(month);

    //   let addresses = [
    //     scoreRegistry.address,
    //     threeScoreRegistry[1],
    //     threeScoreRegistry[2],
    //     ZERO_ADDRESS,
    //     ZERO_ADDRESS,
    //     ZERO_ADDRESS,
    //     ZERO_ADDRESS,
    //     ZERO_ADDRESS,
    //   ];
    //   await ymtMinter.connect(accounts[1]).mintMany(addresses);

    //   //check
    //   let total_minted = BigNumber.from("0");

    //   for (let i = 0; i < 3; i++) {
    //     let gauge = gauges[i];
    //     let minted = await ymtMinter.minted(accounts[1].address, gauge.address);
    //     expect(minted).to.equal(
    //       await gauge.integrateFraction(accounts[1].address)
    //     );
    //     total_minted = total_minted.add(minted);
    //   }

    //   expect(await YMT.balanceOf(accounts[1].address)).to.equal(total_minted);
    // });

    // Test toggling of the mint approval function
    it("test_toggleApproveMint_function", async () => {
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

    // Test minting on behalf of another user
    it("test_mintFor_function", async () => {
      await yamato
        .connect(accounts[1])
        .borrow(ten_to_the_17);

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
      expect(expected.gt(BigNumber.from("0"))).to.be.equal(true);
      expect(await YMT.balanceOf(accounts[1].address)).to.equal(expected);
      expect(
        await ymtMinter.minted(accounts[1].address, scoreRegistry.address)
      ).to.equal(expected);
    });

    // Test mintFor function when not approved
    it("test_mintForFail_function", async () => {
      await yamato
        .connect(accounts[1])
        .borrow(ten_to_the_17);

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
