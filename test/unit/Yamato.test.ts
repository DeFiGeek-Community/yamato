import { ethers } from "hardhat";
import { FakeContract, smock } from "@defi-wonderland/smock";
import chai, { expect } from "chai";
import { Signer, BigNumber } from "ethers";
import {
  CJPY,
  CurrencyOS,
  Pool,
  FeePool,
  PriceFeedV3,
  PriorityRegistry,
  PriorityRegistry__factory,
  Yamato,
  YamatoDepositor,
  YamatoBorrower,
  YamatoRepayer,
  YamatoWithdrawer,
  YamatoRedeemer,
  YamatoSweeper,
  YamatoDummy,
  Yamato__factory,
  YamatoDepositor__factory,
  YamatoBorrower__factory,
  YamatoRepayer__factory,
  YamatoWithdrawer__factory,
  YamatoRedeemer__factory,
  YamatoSweeper__factory,
  YamatoDummy__factory,
  FeePool__factory,
  Pool__factory,
  YMT,
} from "../../typechain";
import { encode, toERC20 } from "../param/helper";
import {
  getFakeProxy,
  getProxy,
  getLinkedProxy,
  getTCR,
} from "../../src/testUtil";

chai.use(smock.matchers);

describe("contract Yamato - pure func quickier tests", function () {
  let mockPool: FakeContract<Pool>;
  let mockFeePool: FakeContract<FeePool>;
  let mockFeed: FakeContract<PriceFeedV3>;
  let mockYMT: FakeContract<YMT>;
  let mockCJPY: FakeContract<CJPY>;
  let mockCurrencyOS: FakeContract<CurrencyOS>;
  let mockPriorityRegistry: FakeContract<PriorityRegistry>;
  let yamato: Yamato;
  let yamatoDepositor: YamatoDepositor;
  let yamatoBorrower: YamatoBorrower;
  let yamatoRepayer: YamatoRepayer;
  let yamatoWithdrawer: YamatoWithdrawer;
  let yamatoRedeemer: YamatoRedeemer;
  let yamatoSweeper: YamatoSweeper;
  let yamatoDummy: YamatoDummy;
  let pool: Pool;
  let priorityRegistry: PriorityRegistry;
  let PRICE: BigNumber;
  let MCR: BigNumber;
  let accounts: Signer[];
  let ownerAddress: string;

  before(async () => {
    accounts = await ethers.getSigners();
    ownerAddress = await accounts[0].getAddress();

    mockPool = await smock.fake<Pool>("Pool");
    mockFeePool = await getFakeProxy<FeePool>("FeePool");
    mockFeed = await getFakeProxy<PriceFeedV3>("PriceFeedV3");
    mockYMT = await smock.fake<YMT>("YMT");
    mockCJPY = await smock.fake<CJPY>("CJPY");
    mockCurrencyOS = await smock.fake<CurrencyOS>("CurrencyOS");

    const PledgeLib = (
      await (await ethers.getContractFactory("PledgeLib")).deploy()
    ).address;

    // Note: Yamato's constructor needs this mock and so the line below has to be called here.
    mockCurrencyOS.priceFeed.returns(mockFeed.address);
    mockCurrencyOS.feePool.returns(mockFeePool.address);
    mockCurrencyOS.currency.returns(mockCJPY.address);

    yamato = await getLinkedProxy<Yamato, Yamato__factory>(
      "Yamato",
      [mockCurrencyOS.address],
      ["PledgeLib"]
    );

    yamatoDepositor = await getLinkedProxy<
      YamatoDepositor,
      YamatoDepositor__factory
    >("YamatoDepositor", [yamato.address], ["PledgeLib"]);

    yamatoBorrower = await getLinkedProxy<
      YamatoBorrower,
      YamatoBorrower__factory
    >("YamatoBorrower", [yamato.address], ["PledgeLib"]);

    yamatoRepayer = await getLinkedProxy<YamatoRepayer, YamatoRepayer__factory>(
      "YamatoRepayer",
      [yamato.address],
      ["PledgeLib"]
    );

    yamatoWithdrawer = await getLinkedProxy<
      YamatoWithdrawer,
      YamatoWithdrawer__factory
    >("YamatoWithdrawer", [yamato.address], ["PledgeLib"]);

    yamatoRedeemer = await getLinkedProxy<
      YamatoRedeemer,
      YamatoRedeemer__factory
    >("YamatoRedeemer", [yamato.address], ["PledgeLib"]);

    yamatoSweeper = await getLinkedProxy<YamatoSweeper, YamatoSweeper__factory>(
      "YamatoSweeper",
      [yamato.address],
      ["PledgeLib"]
    );

    yamatoDummy = await (<YamatoDummy__factory>await ethers.getContractFactory(
      "YamatoDummy",
      {
        libraries: { PledgeLib },
      }
    )).deploy(mockCurrencyOS.address); // This has test funcs to size Yamato contract

    mockPriorityRegistry = await getFakeProxy<PriorityRegistry>(
      "PriorityRegistry"
    );

    await (
      await yamato.setDeps(
        yamatoDepositor.address,
        yamatoBorrower.address,
        yamatoRepayer.address,
        yamatoWithdrawer.address,
        yamatoRedeemer.address,
        yamatoSweeper.address,
        mockPool.address,
        mockPriorityRegistry.address
      )
    ).wait();

    // Note: Will use later for mintCurrency mockery test in borrow spec
    pool = await getProxy<Pool, Pool__factory>("Pool", [yamato.address]);

    // Note: Will use later for the redeem() test
    priorityRegistry = await getLinkedProxy<
      PriorityRegistry,
      PriorityRegistry__factory
    >("PriorityRegistry", [yamato.address], ["PledgeLib"]);

    await (
      await yamatoDummy.setPriorityRegistry(priorityRegistry.address)
    ).wait();

    PRICE = BigNumber.from(260000).mul(1e18 + "");
    MCR = BigNumber.from(130);

    mockCJPY.balanceOf.returns(PRICE.mul(1).mul(100).div(MCR));
    mockPool.depositRedemptionReserve.returns(0);
    mockPool.depositSweepReserve.returns(0);
    mockPool.sendETH.returns(0);
    mockFeed.fetchPrice.returns(PRICE);
    mockFeed.getPrice.returns(PRICE);
    mockFeed.lastGoodPrice.returns(PRICE);
    mockPool.redemptionReserve.returns(1);
    mockPool.sweepReserve.returns(BigNumber.from("99999999000000000000000000"));
    mockPriorityRegistry.yamato.returns(yamato.address);
    mockPriorityRegistry.upsert.returns(0);
    mockPriorityRegistry.remove.returns(0);
  });

  describe("FR()", function () {
    /* Given ICR, get borrowing fee. */
    it(`should be reverted for ICR 11000 pertenk`, async function () {
      await expect(yamatoDummy.FR(11000)).to.be.reverted;
    });
    it(`should be reverted for ICR 11001 pertenk`, async function () {
      await expect(yamatoDummy.FR(11001)).to.be.reverted;
    });
    it(`should be reverted for ICR 11002 pertenk`, async function () {
      await expect(yamatoDummy.FR(11002)).to.be.reverted;
    });
    it(`should be reverted for ICR 11010 pertenk`, async function () {
      await expect(yamatoDummy.FR(11010)).to.be.reverted;
    });
    it(`should be reverted for ICR 12500 pertenk`, async function () {
      await expect(yamatoDummy.FR(12500)).to.be.reverted;
    });
    it(`should be reverted for ICR 12900 pertenk`, async function () {
      await expect(yamatoDummy.FR(12900)).to.be.reverted;
    });
    it(`returns 400 pertenk for ICR 13000 pertenk`, async function () {
      expect(await yamatoDummy.FR(13000)).to.eq(400);
    });
    it(`returns 210 pertenk for ICR 14900 pertenk`, async function () {
      expect(await yamatoDummy.FR(14900)).to.eq(210);
    });
    it(`returns 200 pertenk for ICR 15000 pertenk`, async function () {
      expect(await yamatoDummy.FR(15000)).to.eq(200);
    });
    it(`returns 150 pertenk for ICR 17500 pertenk`, async function () {
      expect(await yamatoDummy.FR(17500)).to.eq(150);
    });
    it(`returns 102 pertenk for ICR 19900 pertenk`, async function () {
      expect(await yamatoDummy.FR(19900)).to.eq(102);
    });
    it(`returns 100 pertenk for ICR 20000 pertenk`, async function () {
      expect(await yamatoDummy.FR(20000)).to.eq(100);
    });
    it(`returns 85 pertenk for ICR 25000 pertenk`, async function () {
      expect(await yamatoDummy.FR(25000)).to.eq(85);
    });
    it(`returns 70 pertenk for ICR 30000 pertenk`, async function () {
      expect(await yamatoDummy.FR(30000)).to.eq(70);
    });
    it(`returns 40 pertenk for ICR 40000 pertenk`, async function () {
      expect(await yamatoDummy.FR(40000)).to.eq(40);
    });
    it(`returns 11 pertenk for ICR 49700 pertenk`, async function () {
      expect(await yamatoDummy.FR(49700)).to.eq(11);
    });
    it(`returns 11 pertenk for ICR 49800 pertenk`, async function () {
      expect(await yamatoDummy.FR(49800)).to.eq(11);
    });
    it(`returns 11 pertenk for ICR 49900 pertenk`, async function () {
      expect(await yamatoDummy.FR(49900)).to.eq(11);
    });
    it(`returns 10 pertenk for ICR 50000 pertenk`, async function () {
      expect(await yamatoDummy.FR(50000)).to.eq(10);
    });
  });
});

describe("contract Yamato", function () {
  let mockPool: FakeContract<Pool>;
  let mockFeePool: FakeContract<FeePool>;
  let mockFeed: FakeContract<PriceFeedV3>;
  let mockYMT: FakeContract<YMT>;
  let mockCJPY: FakeContract<CJPY>;
  let mockCurrencyOS: FakeContract<CurrencyOS>;
  let mockPriorityRegistry: FakeContract<PriorityRegistry>;
  let yamato: Yamato;
  let yamatoDepositor: YamatoDepositor;
  let yamatoBorrower: YamatoBorrower;
  let yamatoRepayer: YamatoRepayer;
  let yamatoWithdrawer: YamatoWithdrawer;
  let yamatoRedeemer: YamatoRedeemer;
  let yamatoSweeper: YamatoSweeper;
  let yamatoDummy: YamatoDummy;
  let pool: Pool;
  let priorityRegistry: PriorityRegistry;
  let PRICE: BigNumber;
  let MCR: BigNumber;
  let accounts: Signer[];
  let ownerAddress: string;

  beforeEach(async () => {
    accounts = await ethers.getSigners();
    ownerAddress = await accounts[0].getAddress();

    mockPool = await smock.fake<Pool>("Pool");
    mockFeePool = await getFakeProxy<FeePool>("FeePool");
    mockFeed = await getFakeProxy<PriceFeedV3>("PriceFeedV3");
    mockYMT = await smock.fake<YMT>("YMT");
    mockCJPY = await smock.fake<CJPY>("CJPY");
    mockCurrencyOS = await smock.fake<CurrencyOS>("CurrencyOS");

    const PledgeLib = (
      await (await ethers.getContractFactory("PledgeLib")).deploy()
    ).address;

    // Note: Yamato's constructor needs this mock and so the line below has to be called here.
    mockCurrencyOS.priceFeed.returns(mockFeed.address);
    mockCurrencyOS.feePool.returns(mockFeePool.address);
    mockCurrencyOS.currency.returns(mockCJPY.address);

    yamato = await getLinkedProxy<Yamato, Yamato__factory>(
      "Yamato",
      [mockCurrencyOS.address],
      ["PledgeLib"]
    );

    yamatoDepositor = await getLinkedProxy<
      YamatoDepositor,
      YamatoDepositor__factory
    >("YamatoDepositor", [yamato.address], ["PledgeLib"]);

    yamatoBorrower = await getLinkedProxy<
      YamatoBorrower,
      YamatoBorrower__factory
    >("YamatoBorrower", [yamato.address], ["PledgeLib"]);

    yamatoRepayer = await getLinkedProxy<YamatoRepayer, YamatoRepayer__factory>(
      "YamatoRepayer",
      [yamato.address],
      ["PledgeLib"]
    );

    yamatoWithdrawer = await getLinkedProxy<
      YamatoWithdrawer,
      YamatoWithdrawer__factory
    >("YamatoWithdrawer", [yamato.address], ["PledgeLib"]);

    yamatoRedeemer = await getLinkedProxy<
      YamatoRedeemer,
      YamatoRedeemer__factory
    >("YamatoRedeemer", [yamato.address], ["PledgeLib"]);

    yamatoSweeper = await getLinkedProxy<YamatoSweeper, YamatoSweeper__factory>(
      "YamatoSweeper",
      [yamato.address],
      ["PledgeLib"]
    );

    yamatoDummy = await (<YamatoDummy__factory>await ethers.getContractFactory(
      "YamatoDummy",
      {
        libraries: { PledgeLib },
      }
    )).deploy(mockCurrencyOS.address); // This has test funcs to size Yamato contract

    mockPriorityRegistry = await getFakeProxy<PriorityRegistry>(
      "PriorityRegistry"
    );

    await (
      await yamato.setDeps(
        yamatoDepositor.address,
        yamatoBorrower.address,
        yamatoRepayer.address,
        yamatoWithdrawer.address,
        yamatoRedeemer.address,
        yamatoSweeper.address,
        mockPool.address,
        mockPriorityRegistry.address
      )
    ).wait();

    // Note: Will use later for mintCurrency mockery test in borrow spec
    pool = await getProxy<Pool, Pool__factory>("Pool", [yamato.address]);

    // Note: Will use later for the redeem() test
    priorityRegistry = await getLinkedProxy<
      PriorityRegistry,
      PriorityRegistry__factory
    >("PriorityRegistry", [yamato.address], ["PledgeLib"]);

    await (
      await yamatoDummy.setPriorityRegistry(priorityRegistry.address)
    ).wait();

    PRICE = BigNumber.from(260000).mul(1e18 + "");
    MCR = BigNumber.from(130);

    mockCJPY.balanceOf.returns(PRICE.mul(1).mul(100).div(MCR));
    mockPool.depositRedemptionReserve.returns(0);
    mockPool.depositSweepReserve.returns(0);
    mockPool.sendETH.returns(0);
    mockFeed.fetchPrice.returns(PRICE);
    mockFeed.getPrice.returns(PRICE);
    mockFeed.lastGoodPrice.returns(PRICE);
    mockPool.redemptionReserve.returns(1);
    mockPool.sweepReserve.returns(BigNumber.from("99999999000000000000000000"));
    mockPriorityRegistry.yamato.returns(yamato.address);
    mockPriorityRegistry.upsert.returns(0);
    mockPriorityRegistry.remove.returns(0);
  });
  describe("setPledge()", function () {
    beforeEach(async () => {
      await (
        await yamato.setDeps(
          yamatoDepositor.address,
          yamatoBorrower.address,
          yamatoRepayer.address,
          yamatoWithdrawer.address,
          yamatoRedeemer.address,
          yamatoSweeper.address,
          mockPool.address,
          mockPriorityRegistry.address
        )
      ).wait();
      const toCollateralize = 1;
      await yamato.deposit({ value: toERC20(toCollateralize + "") });
    });
    it(`should set zero pledge`, async function () {
      let owner = await accounts[0].getAddress();
      await (
        await yamato.setDeps(
          owner, // Note: dirty hack to pass this test
          yamatoBorrower.address,
          yamatoRepayer.address,
          yamatoWithdrawer.address,
          yamatoRedeemer.address,
          yamatoSweeper.address,
          mockPool.address,
          mockPriorityRegistry.address
        )
      ).wait();
      let _pledgeBefore = await yamato.getPledge(owner);
      expect(_pledgeBefore.isCreated).to.be.true;
      await yamato.setPledge(owner, {
        coll: 0,
        debt: 0,
        isCreated: false,
        owner: ethers.constants.AddressZero,
        priority: 0,
      });
      let _pledgeAfter = await yamato.getPledge(owner);
      expect(_pledgeAfter.isCreated).to.be.false;
    });
    it(`should set zero but isCreated=true pledge and neutralize it`, async function () {
      // Note: For full repay and full withdrawal scenario
      let owner = await accounts[0].getAddress();
      await (
        await yamato.setDeps(
          owner, // Note: dirty hack to pass this test
          yamatoBorrower.address,
          yamatoRepayer.address,
          yamatoWithdrawer.address,
          yamatoRedeemer.address,
          yamatoSweeper.address,
          mockPool.address,
          mockPriorityRegistry.address
        )
      ).wait();
      let _pledgeBefore = await yamato.getPledge(owner);
      expect(_pledgeBefore.isCreated).to.be.true;
      await yamato.setPledge(owner, {
        coll: 0,
        debt: 0,
        isCreated: true,
        owner: owner,
        priority: 0,
      });
      let _pledgeAfter = await yamato.getPledge(owner);
      expect(_pledgeAfter.isCreated).to.be.false;
    });
  });

  describe("deposit()", function () {
    it(`succeeds to make a pledge and totalCollDiff>0 totalDebtDiff=0`, async function () {
      const toCollateralize = 1;

      const [totalCollBefore, totalDebtBefore] = await yamato.getStates();

      await yamato.deposit({ value: toERC20(toCollateralize + "") });

      const [totalCollAfter, totalDebtAfter] = await yamato.getStates();

      expect(totalCollAfter).to.gt(totalCollBefore);
      expect(totalDebtAfter).to.eq(totalDebtBefore);
    });
    it(`should run upsert`, async function () {
      const toCollateralize = 1;
      await yamato.deposit({ value: toERC20(toCollateralize + "") });
      expect(mockPriorityRegistry.upsert).to.have.been.called;
    });

    it(`can deposit with a deficit pledge`, async function () {
      const toCollateralize = 1;
      let owner = await accounts[0].getAddress();
      await (
        await yamato.setDeps(
          yamatoDepositor.address, // Note: dirty hack to pass this test
          yamatoBorrower.address,
          yamatoRepayer.address,
          yamatoWithdrawer.address,
          yamatoRedeemer.address,
          owner,
          mockPool.address,
          priorityRegistry.address
        )
      ).wait();

      // Make a deficit pledge with yamato.setPledge(deficitPledge)
      await yamato.setPledge(owner, {
        coll: 0,
        debt: BigNumber.from("300001000000000000000"),
        isCreated: false,
        owner: owner,
        priority: 0,
      });

      // Deposit on it and check not error
      await expect(yamato.deposit({ value: toERC20(toCollateralize + "") })).to
        .be.not.reverted;
    });
  });
  describe("borrow()", function () {
    let MCR;
    beforeEach(async function () {
      MCR = BigNumber.from(130);
      mockPool.depositRedemptionReserve.returns(0);
      mockCurrencyOS.mintCurrency.returns(0);
    });
    it(`succeeds to make a pledge with ICR=130%, and the TCR will be 130%`, async function () {
      const toCollateralize = 1;
      const toBorrow = PRICE.mul(toCollateralize)
        .mul(100)
        .div(MCR)
        .div(1e18 + "");

      await yamato.deposit({ value: toERC20(toCollateralize + "") });

      const [totalCollBefore, totalDebtBefore] = await yamato.getStates();

      await yamato.borrow(toERC20(toBorrow + ""));
      const [totalCollAfter, totalDebtAfter] = await yamato.getStates();
      const _TCR = getTCR(totalCollAfter, totalDebtAfter, PRICE);

      expect(_TCR).to.eq("13000");

      const pledge = await yamato.getPledge(await yamato.signer.getAddress());

      expect(pledge.coll).to.eq("1000000000000000000");
      expect(pledge.debt).to.eq("200000000000000000000000");
      expect(totalCollAfter).to.eq(totalCollBefore);
      expect(totalDebtAfter).to.be.gt(totalDebtBefore);
    });
    it(`should have zero ETH balance after issuance`, async function () {
      const toCollateralize = 1;
      const toBorrow = PRICE.mul(toCollateralize)
        .mul(100)
        .div(MCR)
        .div(1e18 + "");
      await yamato.deposit({ value: toERC20(toCollateralize + "") });
      await yamato.borrow(toERC20(toBorrow + ""));

      const balance = await yamato.provider.getBalance(yamato.address);
      expect(balance).to.eq("0");
    });

    it(`should run fetchPrice() of Pool.sol`, async function () {
      const toCollateralize = 1;
      const toBorrow = PRICE.mul(toCollateralize)
        .mul(100)
        .div(MCR)
        .div(1e18 + "");
      await yamato.deposit({ value: toERC20(toCollateralize + "") });
      await yamato.borrow(toERC20(toBorrow + ""));
      expect(mockFeed.fetchPrice).to.have.been.called;
    });

    it(`should run upsert`, async function () {
      const toCollateralize = 1;
      const toBorrow = PRICE.mul(toCollateralize)
        .mul(100)
        .div(MCR)
        .div(1e18 + "");
      await yamato.deposit({ value: toERC20(toCollateralize + "") });
      await yamato.borrow(toERC20(toBorrow + ""));
      expect(mockPriorityRegistry.upsert).to.have.been.called;
    });

    it(`should run CurrencyOS.mintCurrency() of YamatoBorrower.sol`, async function () {
      const toCollateralize = 1;
      const toBorrow = PRICE.mul(toCollateralize)
        .mul(100)
        .div(MCR)
        .div(1e18 + "");
      await yamato.deposit({ value: toERC20(toCollateralize + "") });
      await yamato.borrow(toERC20(toBorrow + ""));
      expect(mockCJPY.mint).to.have.callCount(0);
      expect(mockCurrencyOS.mintCurrency).to.have.calledOnce; // because pool is a mock
    });
    it(`should run depositRedemptionReserve when RR is inferior to SR`, async function () {
      mockPool.redemptionReserve.returns(1);
      mockPool.sweepReserve.returns(
        BigNumber.from("99999999000000000000000000")
      );
      const toCollateralize = 1;
      const toBorrow = PRICE.mul(toCollateralize)
        .mul(100)
        .div(MCR)
        .div(1e18 + "");
      await yamato.deposit({ value: toERC20(toCollateralize + "") });
      await yamato.borrow(toERC20(toBorrow + ""));
      expect(mockPool.depositRedemptionReserve).to.have.calledOnce;
      expect(mockPool.depositSweepReserve).to.have.callCount(0);
    });
    it(`should run depositSweepReserve when RR is superior to SR`, async function () {
      mockPool.redemptionReserve.returns(10);
      mockPool.sweepReserve.returns(BigNumber.from("1"));
      const toCollateralize = 1;
      const toBorrow = PRICE.mul(toCollateralize)
        .mul(100)
        .div(MCR)
        .div(1e18 + "");
      await yamato.deposit({ value: toERC20(toCollateralize + "") });
      await yamato.borrow(toERC20(toBorrow + ""));
      expect(mockPool.depositRedemptionReserve).to.have.callCount(0);
      expect(mockPool.depositSweepReserve).to.have.calledOnce;
    });
    describe("Context - Pool", async function () {
      it("should run CurrencyOS.mintCurrency() of Pool.sol", async function () {
        await (
          await yamato.setDeps(
            yamatoDepositor.address,
            yamatoBorrower.address,
            yamatoRepayer.address,
            yamatoWithdrawer.address,
            yamatoRedeemer.address,
            yamatoRedeemer.address,
            pool.address,
            mockPriorityRegistry.address
          )
        ).wait();

        const toCollateralize = 1;
        const toBorrow = PRICE.mul(toCollateralize)
          .mul(100)
          .div(MCR)
          .div(1e18 + "");
        await yamato.deposit({ value: toERC20(toCollateralize + "") });
        await yamato.borrow(toERC20(toBorrow + ""));

        expect(mockCurrencyOS.mintCurrency).to.have.callCount(2); // because pool is real
      });
    });
    describe("Context - PriorityRegistry", async function () {
      it("should have priority 13000", async function () {
        await (
          await yamato.setDeps(
            yamatoDepositor.address,
            yamatoBorrower.address,
            yamatoRepayer.address,
            yamatoWithdrawer.address,
            yamatoRedeemer.address,
            yamatoRedeemer.address,
            mockPool.address,
            priorityRegistry.address
          )
        ).wait();

        const toCollateralize = 1;
        const toBorrow = PRICE.mul(toCollateralize)
          .mul(100)
          .div(MCR)
          .div(1e18 + "");
        await yamato.deposit({ value: toERC20(toCollateralize + "") });
        await yamato.borrow(toERC20(toBorrow + ""));

        const pledge = await yamato.getPledge(await yamato.signer.getAddress());
        expect(pledge.priority).to.eq("13000");
      });
    });
  });
  describe("repay()", function () {
    PRICE = BigNumber.from(260000).mul(1e18 + "");
    beforeEach(async function () {
      mockCJPY.balanceOf.returns(PRICE.mul(10));
      mockCurrencyOS.burnCurrency.returns(0);
      mockFeed.fetchPrice.returns(PRICE);
      mockFeed.getPrice.returns(PRICE);
      mockFeed.lastGoodPrice.returns(PRICE);
    });

    it(`should reduce debt`, async function () {
      const MCR = BigNumber.from(130);
      const toCollateralize = 1;
      const toBorrow = PRICE.mul(toCollateralize)
        .mul(100)
        .div(MCR)
        .div(1e18 + "");
      await yamato.deposit({ value: toERC20(toCollateralize + "") });
      await yamato.borrow(toERC20(toBorrow + ""));
      const pledgeBefore = await yamato.getPledge(
        await yamato.signer.getAddress()
      );
      const [totalCollBefore, totalDebtBefore] = await yamato.getStates();

      expect(pledgeBefore.coll).to.eq("1000000000000000000");
      expect(pledgeBefore.debt).to.eq(toERC20(toBorrow + ""));

      await yamato.repay(toERC20(toBorrow + ""));

      const pledgeAfter = await yamato.getPledge(
        await yamato.signer.getAddress()
      );
      const [totalCollAfter, totalDebtAfter] = await yamato.getStates();

      expect(pledgeAfter.coll).to.eq("1000000000000000000");
      expect(pledgeAfter.debt).to.eq("0");
      expect(totalCollAfter).to.be.eq(totalCollBefore);
      expect(totalDebtAfter).to.be.lt(totalDebtBefore);
    });
    it(`should improve TCR`, async function () {
      const MCR = BigNumber.from(130);
      const toCollateralize = 1;
      const toBorrow = PRICE.mul(toCollateralize)
        .mul(100)
        .div(MCR)
        .div(1e18 + "");
      await yamato.deposit({ value: toERC20(toCollateralize + "") });
      await yamato.borrow(toERC20(toBorrow + ""));
      const TCRbefore = getTCR(
        (await yamato.getStates())[0],
        (await yamato.getStates())[1],
        PRICE
      );

      await yamato.repay(toERC20(toBorrow + ""));
      const TCRafter = getTCR(
        (await yamato.getStates())[0],
        (await yamato.getStates())[1],
        PRICE
      );

      expect(TCRafter).to.gt(TCRbefore);
      expect(TCRafter.toString()).to.eq(
        "115792089237316195423570985008687907853269984665640564039457584007913129639935"
      );
    });
    it(`should run burnCurrency`, async function () {
      const MCR = BigNumber.from(130);
      const toCollateralize = 1;
      const toBorrow = PRICE.mul(toCollateralize)
        .mul(100)
        .div(MCR)
        .div(1e18 + "");
      await yamato.deposit({ value: toERC20(toCollateralize + "") });
      await yamato.borrow(toERC20(toBorrow + ""));
      await yamato.repay(toERC20(toBorrow + ""));
      expect(mockCurrencyOS.burnCurrency).to.have.been.calledOnce;
    });

    it(`should run upsert`, async function () {
      const MCR = BigNumber.from(130);
      const toCollateralize = 1;
      const toBorrow = PRICE.mul(toCollateralize)
        .mul(100)
        .div(MCR)
        .div(1e18 + "");
      await yamato.deposit({ value: toERC20(toCollateralize + "") });
      await yamato.borrow(toERC20(toBorrow + ""));
      await yamato.repay(toERC20(toBorrow + ""));
      expect(mockPriorityRegistry.upsert).to.have.been.called;
    });

    it(`can repay even under TCR < MCR`, async function () {
      const MCR = BigNumber.from(130);
      const toCollateralize = 1;
      const toBorrow = PRICE.mul(toCollateralize)
        .mul(100)
        .div(MCR)
        .div(1e18 + "");
      await yamato.deposit({ value: toERC20(toCollateralize + "") });
      await yamato.borrow(toERC20(toBorrow + ""));

      mockFeed.fetchPrice.returns(PRICE.div(2));
      mockFeed.getPrice.returns(PRICE.div(2));
      mockFeed.lastGoodPrice.returns(PRICE.div(2));
      const dumpedTCR = getTCR(
        (await yamato.getStates())[0],
        (await yamato.getStates())[1],
        PRICE.div(2)
      );
      expect(dumpedTCR).to.lt(MCR.mul(10000));

      const TCRbefore = getTCR(
        (await yamato.getStates())[0],
        (await yamato.getStates())[1],
        PRICE.div(2)
      );
      await yamato.repay(toERC20(toBorrow + ""));
      const TCRafter = getTCR(
        (await yamato.getStates())[0],
        (await yamato.getStates())[1],
        PRICE.div(2)
      );

      expect(TCRafter).to.gt(TCRbefore);
    });

    it(`can full repay with and neutralize the pledge`, async function () {
      const MCR = BigNumber.from(130);
      const toCollateralize = 1;
      const toBorrow = PRICE.mul(toCollateralize)
        .mul(100)
        .div(MCR)
        .div(1e18 + "");

      let owner = await accounts[0].getAddress();
      await (
        await yamato.setDeps(
          yamatoDepositor.address, // Note: dirty hack to pass this test
          yamatoBorrower.address,
          yamatoRepayer.address,
          yamatoWithdrawer.address,
          yamatoRedeemer.address,
          owner,
          mockPool.address,
          mockPriorityRegistry.address
        )
      ).wait();
      await yamato.setTotalDebt(toERC20(toBorrow.mul(2) + ""));

      await yamato.setPledge(owner, {
        coll: 0,
        debt: toERC20(toBorrow + ""),
        isCreated: true,
        owner: owner,
        priority: 0,
      });

      await yamato.repay(toERC20(toBorrow + ""));

      const pledgeAfter = await yamato.getPledge(owner);

      expect(pledgeAfter.isCreated).to.be.false;
      expect(pledgeAfter.debt).to.eq(0);
    });

    it(`can repay with a deficit pledge`, async function () {
      const MCR = BigNumber.from(130);
      const toCollateralize = 1;
      const toBorrow = PRICE.mul(toCollateralize)
        .mul(100)
        .div(MCR)
        .div(1e18 + "");

      let owner = await accounts[0].getAddress();
      await (
        await yamato.setDeps(
          yamatoDepositor.address, // Note: dirty hack to pass this test
          yamatoBorrower.address,
          yamatoRepayer.address,
          yamatoWithdrawer.address,
          yamatoRedeemer.address,
          owner,
          mockPool.address,
          priorityRegistry.address
        )
      ).wait();
      await yamato.setTotalDebt(toERC20(toBorrow.mul(2) + ""));

      // Make a deficit pledge with yamato.setPledge(deficitPledge)
      await yamato.setPledge(owner, {
        coll: 0,
        debt: toERC20(toBorrow + ""),
        isCreated: false,
        owner: owner,
        priority: 0,
      });

      // Repay it and check not error
      await expect(yamato.repay(toERC20(toBorrow + ""))).to.be.not.reverted;
    });

    it(`fails for empty cjpy amount`, async function () {
      const MCR = BigNumber.from(130);
      const toCollateralize = 1;
      const toBorrow = PRICE.mul(toCollateralize)
        .mul(100)
        .div(MCR)
        .div(1e18 + "");
      await yamato.deposit({ value: toERC20(toCollateralize + "") });
      await yamato.borrow(toERC20(toBorrow + ""));
      await expect(yamato.repay(toERC20(0 + ""))).to.revertedWith(
        "You are repaying no Currency"
      );
    });
    it(`fails for no-debt pledge`, async function () {
      const MCR = BigNumber.from(130);
      const toCollateralize = 1;
      const toBorrow = PRICE.mul(toCollateralize)
        .mul(100)
        .div(MCR)
        .div(1e18 + "");
      await yamato.deposit({ value: toERC20(toCollateralize + "") });
      await expect(yamato.repay(toERC20(toBorrow + ""))).to.revertedWith(
        "You can't repay for a zero-debt pledge."
      );
    });
  });

  describe("withdraw()", function () {
    const PRICE = BigNumber.from(260000).mul(1e18 + "");
    beforeEach(async function () {
      mockFeed.fetchPrice.returns(PRICE);
      mockFeed.getPrice.returns(PRICE);
      mockFeed.lastGoodPrice.returns(PRICE);
      mockPool.sendETH.returns(0);
    });

    it(`should NOT validate borrow and withdraw in the different block`, async function () {
      const MCR = BigNumber.from(130);
      const toCollateralize = 1;
      const toBorrow = PRICE.mul(toCollateralize)
        .mul(100)
        .div(MCR)
        .div(1e18 + "");
      await yamato.deposit({ value: toERC20(toCollateralize * 2 + "") });
      await yamato.borrow(toERC20(toBorrow + ""));
      await expect(yamato.withdraw(toERC20(toCollateralize / 10 + ""))).to.not
        .reverted;
    });
    it(`should reduce coll and totalColl`, async function () {
      const MCR = BigNumber.from(130);
      const toCollateralize = 1;
      const toBorrow = PRICE.mul(toCollateralize)
        .mul(100)
        .div(MCR)
        .div(1e18 + "")
        .div(2);
      await yamato.deposit({ value: toERC20(toCollateralize + "") });
      await yamato.borrow(toERC20(toBorrow + ""));
      const pledgeBefore = await yamato.getPledge(
        await yamato.signer.getAddress()
      );
      const [totalCollBefore, totalDebtBefore] = await yamato.getStates();

      expect(pledgeBefore.coll).to.eq("1000000000000000000");
      expect(pledgeBefore.debt).to.eq("100000000000000000000000");

      (<any>yamato.provider).send("evm_increaseTime", [60 * 60 * 24 * 3 + 1]);
      (<any>yamato.provider).send("evm_mine");

      await yamato.withdraw(toERC20(toCollateralize / 100 + ""));

      const pledgeAfter = await yamato.getPledge(
        await yamato.signer.getAddress()
      );
      const [totalCollAfter, totalDebtAfter] = await yamato.getStates();

      expect(pledgeAfter.coll.toString()).to.eq(
        toERC20((toCollateralize * 99) / 100 + "").toString()
      );
      expect(pledgeAfter.debt).to.eq("100000000000000000000000");
      expect(totalCollAfter).to.be.lt(totalCollBefore);
      expect(totalDebtAfter).to.eq(totalDebtBefore);
    });
    it(`can't be executed in the ICR < MCR`, async function () {
      const MCR = BigNumber.from(130);
      mockFeed.fetchPrice.returns(PRICE);
      mockFeed.getPrice.returns(PRICE);
      mockFeed.lastGoodPrice.returns(PRICE);
      mockPool.sendETH.returns(0);

      const toCollateralize = 1;
      const toBorrow = PRICE.mul(toCollateralize)
        .mul(100)
        .div(MCR)
        .div(1e18 + "");
      await yamato.deposit({ value: toERC20(toCollateralize + "") });
      await yamato.borrow(toERC20(toBorrow + ""));
      const pledgeBefore = await yamato.getPledge(
        await yamato.signer.getAddress()
      );

      expect(pledgeBefore.coll.toString()).to.eq("1000000000000000000");
      expect(pledgeBefore.debt.toString()).to.eq("200000000000000000000000");

      (<any>yamato.provider).send("evm_increaseTime", [60 * 60 * 24 * 3 + 1]);
      (<any>yamato.provider).send("evm_mine");

      mockFeed.fetchPrice.returns(PRICE.div(4));
      mockFeed.getPrice.returns(PRICE.div(4));
      mockFeed.lastGoodPrice.returns(PRICE.div(4));

      await expect(
        yamato.withdraw(toERC20(toCollateralize / 10 + ""))
      ).to.revertedWith("Withdrawal failure: ICR is not more than MCR.");
    });
    it(`can't run withdrawal because ICR=130%`, async function () {
      const MCR = BigNumber.from(130);
      mockFeed.fetchPrice.returns(PRICE);
      mockFeed.getPrice.returns(PRICE);
      mockFeed.lastGoodPrice.returns(PRICE);
      mockPool.sendETH.returns(0);

      const toCollateralize = 1;
      const toBorrow = PRICE.mul(toCollateralize)
        .mul(100)
        .div(MCR)
        .div(1e18 + "");
      await yamato.deposit({ value: toERC20(toCollateralize + "") });
      await yamato.borrow(toERC20(toBorrow + ""));
      const pledgeBefore = await yamato.getPledge(
        await yamato.signer.getAddress()
      );

      expect(pledgeBefore.coll.toString()).to.eq("1000000000000000000");
      expect(pledgeBefore.debt.toString()).to.eq("200000000000000000000000");

      (<any>yamato.provider).send("evm_increaseTime", [60 * 60 * 24 * 3 + 1]);
      (<any>yamato.provider).send("evm_mine");

      await expect(
        yamato.withdraw(toERC20(toCollateralize * 0.9 + ""))
      ).to.revertedWith("Withdrawal failure: ICR is not more than MCR.");
    });
    it(`can't make ICR < MCR by this withdrawal`, async function () {
      const MCR = BigNumber.from(130);
      mockFeed.fetchPrice.returns(PRICE);
      mockFeed.getPrice.returns(PRICE);
      mockFeed.lastGoodPrice.returns(PRICE);
      mockPool.sendETH.returns(0);

      const toCollateralize = 1;
      const toBorrow = PRICE.mul(toCollateralize)
        .mul(100)
        .div(MCR.add(1))
        .div(1e18 + "");
      await yamato.deposit({ value: toERC20(toCollateralize + "") });
      await yamato.borrow(toERC20(toBorrow + ""));
      const pledgeBefore = await yamato.getPledge(
        await yamato.signer.getAddress()
      );

      expect(pledgeBefore.coll.toString()).to.eq("1000000000000000000");
      expect(pledgeBefore.debt.toString()).to.eq("198473000000000000000000");

      (<any>yamato.provider).send("evm_increaseTime", [60 * 60 * 24 * 3 + 1]);
      (<any>yamato.provider).send("evm_mine");

      await expect(
        yamato.withdraw(toERC20(toCollateralize * 0.9 + ""))
      ).to.revertedWith(
        "Withdrawal failure: ICR can't be less than MCR after withdrawal."
      );
    });
    it(`should neutralize a pledge if clean full withdrawal happens`, async function () {
      const MCR = BigNumber.from(130);
      const toCollateralize = 1;
      await yamato.deposit({ value: toERC20(toCollateralize + "") });

      const _pledgeBefore = await yamato.getPledge(
        await yamato.signer.getAddress()
      );
      expect(_pledgeBefore.isCreated).to.be.true;

      await (await yamato.withdraw(toERC20(toCollateralize + ""))).wait();
      const _pledgeAfter = await yamato.getPledge(
        await yamato.signer.getAddress()
      );
      expect(_pledgeAfter.isCreated).to.be.false;

      expect(mockPriorityRegistry.remove).to.have.calledOnce;
    });
    it(`should revert if withdrawal remaining <0.1ETH happens`, async function () {
      await yamato.deposit({ value: BigNumber.from(1e18 + "") });
      await expect(
        yamato.withdraw(
          BigNumber.from(1e18 + "")
            .sub(1e17 + "")
            .add(1)
        )
      ).to.be.revertedWith(
        "Deposit or Withdraw can't make pledge less than floor size."
      );
    });
    it(`should NOT revert if withdrawal remaining >=0.1ETH happens`, async function () {
      await yamato.deposit({ value: BigNumber.from(1e18 + "") });
      await expect(
        yamato.withdraw(
          BigNumber.from(1e18 + "")
            .sub(1e17 + "")
            .sub(1)
        )
      ).not.to.be.reverted;
    });
    it(`should neutralize a pledge even after full repay`, async function () {
      const MCR = BigNumber.from(130);
      const toCollateralize = 1;
      await yamato.deposit({ value: toERC20(toCollateralize + "") });

      const _pledgeBefore = await yamato.getPledge(
        await yamato.signer.getAddress()
      );
      expect(_pledgeBefore.isCreated).to.be.true;

      await (await yamato.withdraw(toERC20(toCollateralize + ""))).wait();
      const _pledgeAfter = await yamato.getPledge(
        await yamato.signer.getAddress()
      );
      expect(_pledgeAfter.isCreated).to.be.false;

      expect(mockPriorityRegistry.remove).to.have.calledOnce;
    });
    it(`should run sendETH() of Pool.sol`, async function () {
      const toCollateralize = 1;
      await yamato.deposit({ value: toERC20(toCollateralize + "") });
      await yamato.withdraw(toERC20(toCollateralize + ""));

      expect(mockPool.sendETH).to.have.calledOnce;
    });

    describe("Context - PriorityRegistry", async function () {
      it("should neutralize a pledge even after full repay", async function () {
        await (
          await yamato.setDeps(
            yamatoDepositor.address,
            yamatoBorrower.address,
            yamatoRepayer.address,
            yamatoWithdrawer.address,
            yamatoRedeemer.address,
            yamatoRedeemer.address,
            mockPool.address,
            priorityRegistry.address
          )
        ).wait();

        const MCR = BigNumber.from(130);
        const toCollateralize = 1;
        await yamato.deposit({ value: toERC20(toCollateralize + "") });

        const _pledgeBefore = await yamato.getPledge(
          await yamato.signer.getAddress()
        );
        expect(_pledgeBefore.isCreated).to.be.true;

        await (await yamato.withdraw(toERC20(toCollateralize + ""))).wait();
        const _pledgeAfter = await yamato.getPledge(
          await yamato.signer.getAddress()
        );
        expect(_pledgeAfter.isCreated).to.be.false;
      });
    });
  });

  describe("redeem()", function () {
    let accounts,
      PRICE,
      PRICE_AFTER,
      PRICE_AFTER_HIGHER,
      MCR,
      toCollateralize,
      toBorrow;
    beforeEach(async () => {
      accounts = await ethers.getSigners();
      PRICE = BigNumber.from(260000).mul(1e18 + "");
      PRICE_AFTER = PRICE.div(2);
      MCR = BigNumber.from(130);

      mockCJPY.balanceOf.returns(PRICE.mul(10));
      mockPool.depositRedemptionReserve.returns(0);
      mockPool.depositSweepReserve.returns(0);
      mockCurrencyOS.burnCurrency.returns(0);
      mockPool.useRedemptionReserve.returns(0);
      mockPool.sendETH.returns(0);
      mockFeed.fetchPrice.returns(PRICE);
      mockFeed.getPrice.returns(PRICE);
      mockFeed.lastGoodPrice.returns(PRICE);
      mockPool.redemptionReserve.returns(1000000000000);

      await (
        await yamato.setDeps(
          yamatoDepositor.address,
          yamatoBorrower.address,
          yamatoRepayer.address,
          yamatoWithdrawer.address,
          yamatoRedeemer.address,
          yamatoSweeper.address,
          mockPool.address,
          priorityRegistry.address
        )
      ).wait();

      toCollateralize = 1;
      toBorrow = PRICE.mul(toCollateralize)
        .mul(100)
        .div(MCR)
        .div(1e18 + "");

      /* Set lower ICR */
      await yamato
        .connect(accounts[0])
        .deposit({ value: toERC20(toCollateralize + "") });
      await yamato.connect(accounts[0]).borrow(toERC20(toBorrow + ""));
      await yamato
        .connect(accounts[1])
        .deposit({ value: toERC20(toCollateralize + "") });
      await yamato.connect(accounts[1]).borrow(toERC20(toBorrow + ""));
      await yamato
        .connect(accounts[2])
        .deposit({ value: toERC20(toCollateralize + "") });
      await yamato.connect(accounts[2]).borrow(toERC20(toBorrow + ""));

      mockFeed.fetchPrice.returns(PRICE_AFTER);
      mockFeed.getPrice.returns(PRICE_AFTER);
      mockFeed.lastGoodPrice.returns(PRICE_AFTER);

      /* Set higher ICR */
      await yamato
        .connect(accounts[3])
        .deposit({ value: toERC20(toCollateralize * 3 + "") });
      await yamato.connect(accounts[3]).borrow(toERC20(toBorrow + ""));
      await yamato
        .connect(accounts[4])
        .deposit({ value: toERC20(toCollateralize * 3 + "") });
      await yamato.connect(accounts[4]).borrow(toERC20(toBorrow + ""));
      await yamato
        .connect(accounts[5])
        .deposit({ value: toERC20(toCollateralize * 3 + "") });
      await yamato.connect(accounts[5]).borrow(toERC20(toBorrow + ""));
    });

    it(`should expense coll of lowest ICR pledges even if price change make diff between LICR and real ICR`, async function () {
      /*
        Note: lower ICR pledges and higher ICR pledges are in the same LICR rank. Lower one must be redeemed first.
      */
      let _pledge0 = await yamato.getPledge(accounts[0].address);
      let _pledge1 = await yamato.getPledge(accounts[1].address);
      let _pledge2 = await yamato.getPledge(accounts[2].address);
      expect(_pledge0.coll).to.eq(toERC20(toCollateralize + ""));
      expect(_pledge1.coll).to.eq(toERC20(toCollateralize + ""));
      expect(_pledge2.coll).to.eq(toERC20(toCollateralize + ""));

      await yamato
        .connect(accounts[0])
        .redeem(toERC20(toBorrow.mul(3) + ""), false);

      _pledge0 = await yamato.getPledge(accounts[0].address);
      _pledge1 = await yamato.getPledge(accounts[1].address);
      _pledge2 = await yamato.getPledge(accounts[2].address);
      expect(_pledge0.coll).to.eq("0");
      expect(_pledge1.coll).to.eq("0");
      expect(_pledge2.coll).to.eq("0");
    });
    it(`should reduce totalColl and totalDebt`, async function () {
      const PRICE_A_BIT_DUMPED = PRICE.mul(65).div(100);
      mockFeed.fetchPrice.returns(PRICE_A_BIT_DUMPED);
      mockFeed.getPrice.returns(PRICE_A_BIT_DUMPED);
      mockFeed.lastGoodPrice.returns(PRICE_A_BIT_DUMPED);

      const [totalCollBefore, totalDebtBefore] = await yamato.getStates();
      await yamato.connect(accounts[0]).redeem(toERC20(toBorrow + ""), false);
      const [totalCollAfter, totalDebtAfter] = await yamato.getStates();

      expect(totalCollAfter).to.lt(totalCollBefore);
      expect(totalDebtAfter).to.lt(totalDebtBefore);
    });
    it(`should improve TCR when TCR \> 1`, async function () {
      const PRICE_A_BIT_DUMPED = PRICE.mul(65).div(100);
      mockFeed.fetchPrice.returns(PRICE_A_BIT_DUMPED);
      mockFeed.getPrice.returns(PRICE_A_BIT_DUMPED);
      mockFeed.lastGoodPrice.returns(PRICE_A_BIT_DUMPED);

      const TCRBefore = getTCR(
        (await yamato.getStates())[0],
        (await yamato.getStates())[1],
        PRICE_A_BIT_DUMPED
      );
      await yamato.connect(accounts[0]).redeem(toERC20(toBorrow + ""), false);
      const TCRAfter = getTCR(
        (await yamato.getStates())[0],
        (await yamato.getStates())[1],
        PRICE_A_BIT_DUMPED
      );

      expect(TCRAfter).to.gt(TCRBefore);
    });
    it(`should shrink TCR when TCR \< 1`, async function () {
      mockFeed.fetchPrice.returns(PRICE_AFTER.div(2));
      mockFeed.getPrice.returns(PRICE_AFTER.div(2));
      mockFeed.lastGoodPrice.returns(PRICE_AFTER.div(2));
      const TCRBefore = getTCR(
        (await yamato.getStates())[0],
        (await yamato.getStates())[1],
        PRICE_AFTER.div(2)
      );
      await yamato.connect(accounts[0]).redeem(toERC20(toBorrow + ""), false);
      const TCRAfter = getTCR(
        (await yamato.getStates())[0],
        (await yamato.getStates())[1],
        PRICE_AFTER.div(2)
      );

      expect(TCRAfter).to.lt(TCRBefore);
    });
    it(`should not run if there are no ICR \< MCR pledges`, async function () {
      mockFeed.fetchPrice.returns(PRICE.mul(3));
      mockFeed.getPrice.returns(PRICE.mul(3));
      mockFeed.lastGoodPrice.returns(PRICE.mul(3));
      await expect(
        yamato.connect(accounts[0]).redeem(toERC20(toBorrow + ""), false)
      ).to.revertedWith("No pledges are redeemed.");
    });
    it(`should NOT run useRedemptionReserve\(\) of Pool.sol when isCoreRedemption=false`, async function () {
      await yamato.connect(accounts[0]).redeem(toERC20(toBorrow + ""), false);
      expect(mockPool.useRedemptionReserve).to.have.callCount(0);
    });
    it(`should run useRedemptionReserve\(\) of Pool.sol when isCoreRedemption=true`, async function () {
      mockPool.redemptionReserve.returns(PRICE.mul(1));
      await yamato.connect(accounts[0]).redeem(toERC20(toBorrow + ""), true);
      expect(mockPool.useRedemptionReserve).to.have.calledOnce;
    });

    it(`should run sendETH\(\) of Pool.sol for successful redeemer`, async function () {
      await yamato.connect(accounts[0]).redeem(toERC20(toBorrow + ""), false);
      expect(mockPool.sendETH).to.have.calledTwice;
    });
    it(`should run burnCurrency\(\) of Yamato.sol for successful redeemer`, async function () {
      await yamato.connect(accounts[0]).redeem(toERC20(toBorrow + ""), false);
      expect(mockCurrencyOS.burnCurrency).to.have.calledOnce;
    });
    it(`should NOT revert if excessive redemption amount comes in.`, async function () {
      await (
        await yamato
          .connect(accounts[0])
          .deposit({ value: BigNumber.from(1e18 + "").mul(170) })
      ).wait();
      let toBorrowHuge = BigNumber.from(1e18 + "")
        .mul(165)
        .mul(PRICE_AFTER)
        .mul(100)
        .div(MCR)
        .div(1e18 + "");
      await (await yamato.connect(accounts[0]).borrow(toBorrowHuge)).wait();

      mockCJPY.balanceOf.returns(toBorrowHuge.mul(11).div(10));

      await expect(yamato.connect(accounts[0]).redeem(toBorrowHuge, false)).not
        .to.be.reverted;
    });
    it(`should revert if one doesn't have enough CJPY balance`, async function () {
      await (
        await yamato
          .connect(accounts[0])
          .deposit({ value: BigNumber.from(1e18 + "").mul(170) })
      ).wait();
      let toBorrowHuge = BigNumber.from(1e18 + "")
        .mul(165)
        .mul(PRICE_AFTER)
        .mul(100)
        .div(MCR)
        .div(1e18 + "");
      await (await yamato.connect(accounts[0]).borrow(toBorrowHuge)).wait();

      mockCJPY.balanceOf.returns(toERC20(toBorrow.mul(70) + ""));

      await expect(
        yamato.connect(accounts[0]).redeem(toBorrowHuge, false)
      ).to.be.revertedWith("Insufficient currency balance to redeem.");
    });
  });

  describe("sweep()", function () {
    let accounts, PRICE, PRICE_AFTER, MCR, toCollateralize, toBorrow;
    beforeEach(async () => {
      accounts = await ethers.getSigners();
      PRICE = BigNumber.from(260000).mul(1e18 + "");
      PRICE_AFTER = PRICE.div(2);
      MCR = BigNumber.from(130);
      mockCJPY.balanceOf.returns(PRICE.mul(10));
      mockPool.depositRedemptionReserve.returns(0);
      mockPool.depositSweepReserve.returns(0);
      mockPool.sendETH.returns(0);
      mockPool.useSweepReserve.returns(0);
      mockPool.sweepReserve.returns(
        BigNumber.from("99999999000000000000000000")
      );
      mockFeed.fetchPrice.returns(PRICE);
      mockFeed.getPrice.returns(PRICE);
      mockFeed.lastGoodPrice.returns(PRICE);
      mockCurrencyOS.burnCurrency.returns(0);

      await (
        await yamato.setDeps(
          yamatoDepositor.address,
          yamatoBorrower.address,
          yamatoRepayer.address,
          yamatoWithdrawer.address,
          yamatoRedeemer.address,
          yamatoSweeper.address,
          mockPool.address,
          priorityRegistry.address
        )
      ).wait();

      /*
          Set redemption targets
        */
      toCollateralize = 1;
      const toBorrow = PRICE.mul(toCollateralize)
        .mul(100)
        .div(MCR)
        .div(1e18 + "");

      await yamato
        .connect(accounts[2])
        .deposit({ value: toERC20(toCollateralize + "") });
      await yamato.connect(accounts[2]).borrow(toERC20(toBorrow + ""));
      await yamato
        .connect(accounts[3])
        .deposit({ value: toERC20(toCollateralize + "") });
      await yamato.connect(accounts[3]).borrow(toERC20(toBorrow + ""));

      /*
          Make those undercollateralized
        */
      mockFeed.fetchPrice.returns(PRICE_AFTER);
      mockFeed.getPrice.returns(PRICE_AFTER);
      mockFeed.lastGoodPrice.returns(PRICE_AFTER);

      /*
          Make sludge pledges
        */
      const toRedeem = PRICE_AFTER.mul(toCollateralize)
        .mul(2)
        .mul(100)
        .div(MCR)
        .div(1e18 + "");

      await (
        await yamato.connect(accounts[0]).redeem(toERC20(toRedeem + ""), false)
      ).wait();
    });

    it(`should improve TCR after sweeping`, async function () {
      const [totalCollBefore, totalDebtBefore] = await yamato.getStates();

      const _TCRBefore = getTCR(totalCollBefore, totalDebtBefore, PRICE_AFTER);
      await (await yamato.connect(accounts[1]).sweep()).wait();
      const [totalCollAfter, totalDebtAfter] = await yamato.getStates();
      const _TCRAfter = getTCR(totalCollAfter, totalDebtAfter, PRICE_AFTER);

      expect(_TCRAfter).to.gt(_TCRBefore);
      expect(totalCollAfter).to.eq(totalCollBefore);
      expect(totalDebtAfter).to.lt(totalDebtBefore);
    });

    it(`should run fetchPrice() of PriceFeed.sol and sendCurrency() of Pool.sol`, async function () {
      await (await yamato.connect(accounts[1]).sweep()).wait();

      expect(mockFeed.fetchPrice).to.have.called;
      expect(mockPool.sendCurrency).to.have.calledOnce;
      expect(mockPool.useSweepReserve).to.have.calledTwice; // two pledges will be swept
    });
  });

  describe("getStates()", () => {
    let accounts, MCR, RRR, SRR, GRR;

    beforeEach(async () => {
      accounts = await ethers.getSigners();
      MCR = await yamato.MCR();
      RRR = await yamato.RRR();
      SRR = await yamato.SRR();
      GRR = await yamato.GRR();
    });

    it("should return correct values", async () => {
      const beforeValues = await yamato.getStates();

      expect(beforeValues[0]).to.eq(0);
      expect(beforeValues[1]).to.eq(0);

      const toCollateralize = 1;
      const toBorrow = PRICE.mul(toCollateralize)
        .mul(100)
        .div(MCR)
        .div(1e18 + "");
      await yamato
        .connect(accounts[0])
        .deposit({ value: toERC20(toCollateralize + "") });
      await yamato.connect(accounts[0]).borrow(toERC20(toBorrow + ""));
      const afterValues = await yamato.getStates();

      expect(afterValues[0]).to.eq("1000000000000000000");
      expect(afterValues[1]).to.eq("200000000000000000000000");
      expect(afterValues[2]).to.eq(MCR);
      expect(afterValues[3]).to.eq(RRR);
      expect(afterValues[4]).to.eq(SRR);
      expect(afterValues[5]).to.eq(GRR);
    });
  });

  describe("getIndividualStates()", () => {
    let accounts;

    beforeEach(async () => {
      accounts = await ethers.getSigners();
    });

    it("should return correct values", async () => {
      const owner = await accounts[0].getAddress();

      const beforeValues = await yamato.getIndividualStates(owner);

      expect(beforeValues[0]).to.eq(0);
      expect(beforeValues[1]).to.eq(0);

      const toCollateralize = 1;
      const toBorrow = PRICE.mul(toCollateralize)
        .mul(100)
        .div(MCR)
        .div(1e18 + "");
      await yamato
        .connect(accounts[0])
        .deposit({ value: toERC20(toCollateralize + "") });
      await yamato.connect(accounts[0]).borrow(toERC20(toBorrow + ""));
      const afterValues = await yamato.getIndividualStates(owner);

      expect(afterValues[0]).to.eq("1000000000000000000");
      expect(afterValues[1]).to.eq("200000000000000000000000");
      expect(afterValues[2]).to.eq(true);
    });
  });

  describe("toggle()", () => {
    let accounts;

    beforeEach(async () => {
      accounts = await ethers.getSigners();
    });

    it("should pause Yamato.sol", async () => {
      const beforePaused = await yamato.paused();
      expect(beforePaused).to.be.false;

      await yamato.connect(accounts[0]).toggle();

      const afterPaused = await yamato.paused();
      expect(afterPaused).to.be.true;
    });
  });

  it("should work after pause", async () => {
    const beforePaused = await yamato.paused();
    expect(beforePaused).to.be.false;

    await yamato.connect(accounts[0]).toggle();

    const afterPaused = await yamato.paused();
    expect(afterPaused).to.be.true;

    await yamato.connect(accounts[0]).toggle();

    const lastPaused = await yamato.paused();
    expect(lastPaused).to.be.false;
  });
});
