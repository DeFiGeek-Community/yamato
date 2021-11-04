import { ethers } from "hardhat";
import { FakeContract, smock } from "@defi-wonderland/smock";
import chai, { expect } from "chai";
import { solidity } from "ethereum-waffle";
import { Signer, BigNumber } from "ethers";
import {
  CJPY,
  CjpyOS,
  Pool,
  FeePool,
  PriceFeed,
  PriorityRegistry,
  PriorityRegistry__factory,
  Yamato,
  YamatoHelper,
  YamatoDummy,
  Yamato__factory,
  YamatoHelper__factory,
  YamatoDummy__factory,
  FeePool__factory,
  YMT,
} from "../../typechain";
import { encode, toERC20 } from "../param/helper";
import { getFakeProxy, getLinkedProxy } from "../../src/testUtil";

chai.use(smock.matchers);
chai.use(solidity);

describe("contract Yamato", function () {
  let mockPool: FakeContract<Pool>;
  let mockYamatoHelper: FakeContract<YamatoHelper>;
  let mockFeePool: FakeContract<FeePool>;
  let mockFeed: FakeContract<PriceFeed>;
  let mockYMT: FakeContract<YMT>;
  let mockCJPY: FakeContract<CJPY>;
  let mockCjpyOS: FakeContract<CjpyOS>;
  let mockPriorityRegistry: FakeContract<PriorityRegistry>;
  let yamato: Yamato;
  let yamatoHelper: YamatoHelper;
  let yamatoDummy: YamatoDummy;
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
    mockFeed = await getFakeProxy<PriceFeed>("PriceFeed");
    mockYMT = await smock.fake<YMT>("YMT");
    mockCJPY = await smock.fake<CJPY>("CJPY");
    mockCjpyOS = await smock.fake<CjpyOS>("CjpyOS");

    const PledgeLib = (
      await (await ethers.getContractFactory("PledgeLib")).deploy()
    ).address;

    // Note: Yamato's constructor needs this mock and so the line below has to be called here.
    mockCjpyOS.feed.returns(mockFeed.address);
    mockCjpyOS.feePool.returns(mockFeePool.address);

    yamato = await getLinkedProxy<Yamato, Yamato__factory>(
      "Yamato",
      [mockCjpyOS.address],
      ["PledgeLib"]
    );
    yamatoHelper = await getLinkedProxy<YamatoHelper, YamatoHelper__factory>(
      "YamatoHelper",
      [yamato.address],
      ["PledgeLib"]
    );

    yamatoDummy = await (<YamatoDummy__factory>await ethers.getContractFactory(
      "YamatoDummy",
      {
        libraries: { PledgeLib },
      }
    )).deploy(mockCjpyOS.address); // This has test funcs to size Yamato contract

    mockPriorityRegistry = await getFakeProxy<PriorityRegistry>(
      "PriorityRegistry"
    );

    await (await yamatoHelper.setPool(mockPool.address)).wait();
    await (
      await yamatoHelper.setPriorityRegistry(mockPriorityRegistry.address)
    ).wait();
    await (await yamato.setYamatoHelper(yamatoHelper.address)).wait();

    // Note: Will use later for the redeem() test
    priorityRegistry = await getLinkedProxy<
      PriorityRegistry,
      PriorityRegistry__factory
    >("PriorityRegistry", [yamatoHelper.address], ["PledgeLib"]);

    await (
      await yamatoDummy.setPriorityRegistry(priorityRegistry.address)
    ).wait();

    PRICE = BigNumber.from(260000).mul(1e18 + "");
    MCR = BigNumber.from(110);

    mockPool.depositRedemptionReserve.returns(0);
    mockPool.depositSweepReserve.returns(0);
    mockPool.lockETH.returns(0);
    mockPool.sendETH.returns(0);
    mockFeed.fetchPrice.returns(PRICE);
    mockFeed.lastGoodPrice.returns(PRICE);
    await (await yamato.updateTCR()).wait();
    mockPool.redemptionReserve.returns(1);
    mockPool.sweepReserve.returns(BigNumber.from("99999999000000000000000000"));
    mockPriorityRegistry.yamato.returns(yamato.address);
    mockPriorityRegistry.upsert.returns(0);
    mockPriorityRegistry.remove.returns(0);
    mockPriorityRegistry.popRedeemable.returns(
      encode(
        ["uint256", "uint256", "bool", "address", "uint256"],
        [
          BigNumber.from("1000000000000000"),
          BigNumber.from("300001000000000000000"),
          true,
          await yamato.signer.getAddress(),
          0,
        ]
      )
    );
    mockPriorityRegistry.popSweepable.returns(
      encode(
        ["uint256", "uint256", "bool", "address", "uint256"],
        [
          BigNumber.from(0),
          BigNumber.from("300001000000000000000"),
          true,
          await yamato.signer.getAddress(),
          0,
        ]
      )
    );
  });
  describe("setPledge()", function () {
    beforeEach(async () => {
      let mockYamatoHelper = await getFakeProxy<YamatoHelper>("YamatoHelper");
      mockYamatoHelper.priorityRegistry.returns(mockPriorityRegistry.address);
      mockYamatoHelper.pool.returns(mockPool.address);
      await yamato.setYamatoHelper(mockYamatoHelper.address);
      mockYamatoHelper.permitDeps.returns(true);
      const toCollateralize = 1;
      await yamato.deposit({ value: toERC20(toCollateralize + "") });
    });
    it(`should set zero pledge`, async function () {
      let owner = await accounts[0].getAddress();
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
  });

  describe("deposit()", function () {
    it(`succeeds to make a pledge and totalCollDiff>0 totalDebtDiff=0`, async function () {
      const toCollateralize = 1;

      const statesBefore = await yamato.getStates();
      const totalCollBefore = statesBefore[0];
      const totalDebtBefore = statesBefore[1];

      await yamato.deposit({ value: toERC20(toCollateralize + "") });

      const statesAfter = await yamato.getStates();
      const totalCollAfter = statesAfter[0];
      const totalDebtAfter = statesAfter[1];

      expect(totalCollAfter).to.gt(totalCollBefore);
      expect(totalDebtAfter).to.eq(totalDebtBefore);
    });
    it(`should run upsert`, async function () {
      const toCollateralize = 1;
      await yamato.deposit({ value: toERC20(toCollateralize + "") });
      expect(mockPriorityRegistry.upsert).to.have.been.called;
    });
  });
  describe("FR()", function () {
    /* Given ICR, get borrowing fee. */
    it(`returns 2000 pertenk for ICR 11000 pertenk`, async function () {
      expect(await yamatoDummy.FR(11000)).to.eq(2000);
    });
    it(`returns 2000 pertenk for ICR 11001 pertenk`, async function () {
      expect(await yamatoDummy.FR(11001)).to.eq(2000);
    });
    it(`returns 1999 pertenk for ICR 11002 pertenk`, async function () {
      expect(await yamatoDummy.FR(11002)).to.eq(1999);
    });
    it(`returns 1992 pertenk for ICR 11010 pertenk`, async function () {
      expect(await yamatoDummy.FR(11010)).to.eq(1992);
    });
    it(`returns 800 pertenk for ICR 12500 pertenk`, async function () {
      expect(await yamatoDummy.FR(12500)).to.eq(800);
    });
    it(`returns 480 pertenk for ICR 12900 pertenk`, async function () {
      expect(await yamatoDummy.FR(12900)).to.eq(480);
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
  describe("borrow()", function () {
    let MCR;
    beforeEach(async function () {
      MCR = BigNumber.from(110);
      mockPool.depositRedemptionReserve.returns(0);
      mockCjpyOS.mintCJPY.returns(0);
    });
    it(`succeeds to make a pledge with ICR=110%, and the TCR will be 110%`, async function () {
      const toCollateralize = 1;
      const toBorrow = PRICE.mul(toCollateralize)
        .mul(100)
        .div(MCR)
        .div(1e18 + "");
      await yamato.deposit({ value: toERC20(toCollateralize + "") });
      await yamato.borrow(toERC20(toBorrow + ""));
      const _TCR = await yamato.TCR();

      expect(_TCR).to.eq("11000");

      const pledge = await yamato.getPledge(await yamato.signer.getAddress());

      expect(pledge.coll.toString()).to.eq("1000000000000000000");
      expect(pledge.debt.toString()).to.eq("236363000000000000000000");
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
      expect(balance.toString()).to.eq("0");
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

    it(`should run CjpyOS.mintCJPY() of Pool.sol`, async function () {
      const toCollateralize = 1;
      const toBorrow = PRICE.mul(toCollateralize)
        .mul(100)
        .div(MCR)
        .div(1e18 + "");
      await yamato.deposit({ value: toERC20(toCollateralize + "") });
      await yamato.borrow(toERC20(toBorrow + ""));
      expect(mockCJPY.mint).to.have.callCount(0);
      expect(mockCjpyOS.mintCJPY).to.have.callCount(2);
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
  });
  describe("repay()", function () {
    PRICE = BigNumber.from(260000).mul(1e18 + "");
    beforeEach(async function () {
      mockCjpyOS.burnCJPY.returns(0);
      mockFeed.fetchPrice.returns(PRICE);
      mockFeed.lastGoodPrice.returns(PRICE);
      await (await yamato.updateTCR()).wait();
    });

    it(`should reduce debt`, async function () {
      const MCR = BigNumber.from(110);
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
      expect(pledgeBefore.debt.toString()).to.eq(toERC20(toBorrow + ""));

      await yamato.repay(toERC20(toBorrow + ""));

      const pledgeAfter = await yamato.getPledge(
        await yamato.signer.getAddress()
      );

      expect(pledgeAfter.coll.toString()).to.eq("1000000000000000000");
      expect(pledgeAfter.debt.toString()).to.eq("0");
    });
    it(`should improve TCR`, async function () {
      const MCR = BigNumber.from(110);
      const toCollateralize = 1;
      const toBorrow = PRICE.mul(toCollateralize)
        .mul(100)
        .div(MCR)
        .div(1e18 + "");
      await yamato.deposit({ value: toERC20(toCollateralize + "") });
      await yamato.borrow(toERC20(toBorrow + ""));
      const TCRbefore = await yamato.TCR();

      await yamato.repay(toERC20(toBorrow + ""));
      const TCRafter = await yamato.TCR();

      expect(TCRafter).to.gt(TCRbefore);
      expect(TCRafter.toString()).to.eq(
        "115792089237316195423570985008687907853269984665640564039457584007913129639935"
      );
    });
    it(`should run burnCJPY`, async function () {
      const MCR = BigNumber.from(110);
      const toCollateralize = 1;
      const toBorrow = PRICE.mul(toCollateralize)
        .mul(100)
        .div(MCR)
        .div(1e18 + "");
      await yamato.deposit({ value: toERC20(toCollateralize + "") });
      await yamato.borrow(toERC20(toBorrow + ""));
      await yamato.repay(toERC20(toBorrow + ""));
      expect(mockCjpyOS.burnCJPY).to.have.been.calledOnce;
    });

    it(`should run upsert`, async function () {
      const MCR = BigNumber.from(110);
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
      const MCR = BigNumber.from(110);
      const toCollateralize = 1;
      const toBorrow = PRICE.mul(toCollateralize)
        .mul(100)
        .div(MCR)
        .div(1e18 + "");
      await yamato.deposit({ value: toERC20(toCollateralize + "") });
      await yamato.borrow(toERC20(toBorrow + ""));

      mockFeed.fetchPrice.returns(PRICE.div(2));
      mockFeed.lastGoodPrice.returns(PRICE.div(2));
      // Note: update TCR
      await (await yamato.updateTCR()).wait();
      const dumpedTCR = await yamato.TCR();
      expect(dumpedTCR).to.lt(MCR.mul(10000));

      const TCRbefore = await yamato.TCR();
      await yamato.repay(toERC20(toBorrow + ""));
      const TCRafter = await yamato.TCR();

      expect(TCRafter).to.gt(TCRbefore);
    });
    it(`fails for empty cjpy amount`, async function () {
      const MCR = BigNumber.from(110);
      const toCollateralize = 1;
      const toBorrow = PRICE.mul(toCollateralize)
        .mul(100)
        .div(MCR)
        .div(1e18 + "");
      await yamato.deposit({ value: toERC20(toCollateralize + "") });
      await yamato.borrow(toERC20(toBorrow + ""));
      await expect(yamato.repay(toERC20(0 + ""))).to.revertedWith(
        "You are repaying no CJPY"
      );
    });
    it(`fails for no-debt pledge`, async function () {
      const MCR = BigNumber.from(110);
      const toCollateralize = 1;
      const toBorrow = PRICE.mul(toCollateralize)
        .mul(100)
        .div(MCR)
        .div(1e18 + "");
      await yamato.deposit({ value: toERC20(toCollateralize + "") });
      await expect(yamato.repay(toERC20(toBorrow + ""))).to.revertedWith(
        "You are repaying more than you are owing."
      );
    });

    // TODO: Have a attack contract to recursively calls the deposit and borrow function
    it.skip(`TODO: should validate locked state`);
  });

  describe("withdraw()", function () {
    const PRICE = BigNumber.from(260000).mul(1e18 + "");
    beforeEach(async function () {
      mockFeed.fetchPrice.returns(PRICE);
      mockFeed.lastGoodPrice.returns(PRICE);
      await (await yamato.updateTCR()).wait();
      mockPool.sendETH.returns(0);
    });

    it(`should validate locked state`, async function () {
      const MCR = BigNumber.from(110);
      const toCollateralize = 1;
      const toBorrow = PRICE.mul(toCollateralize)
        .mul(100)
        .div(MCR)
        .div(1e18 + "");
      await yamato.deposit({ value: toERC20(toCollateralize + "") });
      await yamato.borrow(toERC20(toBorrow + ""));
      await expect(
        yamato.withdraw(toERC20(toCollateralize / 10 + ""))
      ).to.revertedWith("Withdrawal is being locked for this sender.");
    });
    it(`should reduce coll`, async function () {
      const MCR = BigNumber.from(110);
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

      expect(pledgeBefore.coll.toString()).to.eq("1000000000000000000");
      expect(pledgeBefore.debt.toString()).to.eq("118181000000000000000000");

      (<any>yamato.provider).send("evm_increaseTime", [60 * 60 * 24 * 3 + 1]);
      (<any>yamato.provider).send("evm_mine");

      await yamato.withdraw(toERC20(toCollateralize / 100 + ""));

      const pledgeAfter = await yamato.getPledge(
        await yamato.signer.getAddress()
      );

      expect(pledgeAfter.coll.toString()).to.eq(
        toERC20((toCollateralize * 99) / 100 + "").toString()
      );
      expect(pledgeAfter.debt.toString()).to.eq("118181000000000000000000");
    });
    it(`can't be executed in the ICR < MCR`, async function () {
      const MCR = BigNumber.from(110);
      mockFeed.fetchPrice.returns(PRICE);
      mockFeed.lastGoodPrice.returns(PRICE);
      await (await yamato.updateTCR()).wait();
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
      expect(pledgeBefore.debt.toString()).to.eq("236363000000000000000000");

      (<any>yamato.provider).send("evm_increaseTime", [60 * 60 * 24 * 3 + 1]);
      (<any>yamato.provider).send("evm_mine");

      mockFeed.fetchPrice.returns(PRICE.div(4));
      mockFeed.lastGoodPrice.returns(PRICE.div(4));
      await (await yamato.updateTCR()).wait();

      await expect(
        yamato.withdraw(toERC20(toCollateralize / 10 + ""))
      ).to.revertedWith("Withdrawal failure: ICR is not more than MCR.");
    });
    it(`can't make ICR < MCR by this withdrawal`, async function () {
      const MCR = BigNumber.from(110);
      mockFeed.fetchPrice.returns(PRICE);
      mockFeed.lastGoodPrice.returns(PRICE);
      await (await yamato.updateTCR()).wait();
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
      expect(pledgeBefore.debt.toString()).to.eq("236363000000000000000000");

      (<any>yamato.provider).send("evm_increaseTime", [60 * 60 * 24 * 3 + 1]);
      (<any>yamato.provider).send("evm_mine");

      await expect(
        yamato.withdraw(toERC20(toCollateralize * 0.9 + ""))
      ).to.revertedWith(
        "Withdrawal failure: ICR can't be less than MCR after withdrawal."
      );
    });
    it(`should neutralize a pledge if clean full withdrawal happens`, async function () {
      const MCR = BigNumber.from(110);
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
      MCR = BigNumber.from(110);
      mockPool.depositRedemptionReserve.returns(0);
      mockPool.depositSweepReserve.returns(0);
      mockPool.lockETH.returns(0);
      mockCjpyOS.burnCJPY.returns(0);
      mockPool.useRedemptionReserve.returns(0);
      mockPool.sendETH.returns(0);
      mockFeed.fetchPrice.returns(PRICE);
      mockFeed.lastGoodPrice.returns(PRICE);
      mockPool.redemptionReserve.returns(1000000000000);
      await (await yamato.updateTCR()).wait();

      await (
        await yamatoHelper.setPriorityRegistryInTest(priorityRegistry.address)
      ).wait();
      await yamato.setYamatoHelper(yamatoHelper.address)

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
      mockFeed.lastGoodPrice.returns(PRICE_AFTER);
      await (await yamato.updateTCR()).wait();

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
    it(`should improve TCR when TCR \> 1`, async function () {
      const PRICE_A_BIT_DUMPED = PRICE.mul(65).div(100);
      mockFeed.fetchPrice.returns(PRICE_A_BIT_DUMPED);
      mockFeed.lastGoodPrice.returns(PRICE_A_BIT_DUMPED);

      const TCRBefore = await yamato.TCR();
      await yamato.connect(accounts[0]).redeem(toERC20(toBorrow + ""), false);
      const TCRAfter = await yamato.TCR();

      expect(TCRAfter).to.gt(TCRBefore);
    });
    it(`should shrink TCR when TCR \< 1`, async function () {
      mockFeed.fetchPrice.returns(PRICE_AFTER.div(2));
      mockFeed.lastGoodPrice.returns(PRICE_AFTER.div(2));
      await (await yamato.updateTCR()).wait();
      const TCRBefore = await yamato.TCR();
      await yamato.connect(accounts[0]).redeem(toERC20(toBorrow + ""), false);
      const TCRAfter = await yamato.TCR();

      expect(TCRAfter).to.lt(TCRBefore);
    });
    it(`should not run if there are no ICR \< MCR pledges`, async function () {
      mockFeed.fetchPrice.returns(PRICE.mul(3));
      mockFeed.lastGoodPrice.returns(PRICE.mul(3));
      await (await yamato.updateTCR()).wait();
      await expect(
        yamato.connect(accounts[0]).redeem(toERC20(toBorrow + ""), false)
      ).to.revertedWith("No pledges are redeemed.");
    });
    it(`should NOT run useRedemptionReserve\(\) of Pool.sol when isCoreRedemption=false`, async function () {
      await yamato.connect(accounts[0]).redeem(toERC20(toBorrow + ""), false);
      expect(mockPool.useRedemptionReserve).to.have.callCount(0);
    });
    it(`should run useRedemptionReserve\(\) of Pool.sol when isCoreRedemption=true`, async function () {
      await yamato.connect(accounts[0]).redeem(toERC20(toBorrow + ""), true);
      expect(mockPool.useRedemptionReserve).to.have.calledOnce;
    });

    it(`should NOT run useRedemptionReserve\(\) of Pool.sol when isCoreRedemption=false`, async function () {
      await yamato.connect(accounts[0]).redeem(toERC20(toBorrow + ""), false);
      expect(mockPool.useRedemptionReserve).to.have.callCount(0);
    });
    it(`should run useRedemptionReserve\(\) of Pool.sol when isCoreRedemption=true`, async function () {
      await yamato.connect(accounts[0]).redeem(toERC20(toBorrow + ""), true);
      expect(mockPool.useRedemptionReserve).to.have.calledOnce;
    });

    it(`should run sendETH\(\) of Pool.sol for successful redeemer`, async function () {
      await yamato.connect(accounts[0]).redeem(toERC20(toBorrow + ""), false);
      expect(mockPool.sendETH).to.have.calledTwice;
    });
    it(`should run burnCJPY\(\) of Yamato.sol for successful redeemer`, async function () {
      await yamato.connect(accounts[0]).redeem(toERC20(toBorrow + ""), false);
      expect(mockCjpyOS.burnCJPY).to.have.calledOnce;
    });
    it.skip(`TODO: should NOT revert if excessive redemption amount comes in.`);
  });

  describe("sweep()", function () {
    let accounts, PRICE, PRICE_AFTER, MCR, toCollateralize, toBorrow;
    beforeEach(async () => {
      accounts = await ethers.getSigners();
      PRICE = BigNumber.from(260000).mul(1e18 + "");
      PRICE_AFTER = PRICE.div(2);
      MCR = BigNumber.from(110);
      mockPool.depositRedemptionReserve.returns(0);
      mockPool.depositSweepReserve.returns(0);
      mockPool.lockETH.returns(0);
      mockPool.sendETH.returns(0);
      mockPool.sendCJPY.returns(0);
      mockPool.useSweepReserve.returns(0);
      mockPool.sweepReserve.returns(
        BigNumber.from("99999999000000000000000000")
      );
      mockFeed.fetchPrice.returns(PRICE);
      mockFeed.lastGoodPrice.returns(PRICE);
      await (await yamato.updateTCR()).wait();
      mockCjpyOS.burnCJPY.returns(0);

      await (
        await yamatoHelper.setPriorityRegistryInTest(priorityRegistry.address)
      ).wait();
      await yamato.setYamatoHelper(yamatoHelper.address)

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
      mockFeed.lastGoodPrice.returns(PRICE_AFTER);
      await (await yamato.updateTCR()).wait();

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
      const _TCRBefore = await yamato.TCR();
      await (await yamato.connect(accounts[1]).sweep()).wait();
      const _TCRAfter = await yamato.TCR();

      expect(_TCRAfter).to.gt(_TCRBefore);
    });

    it(`should run fetchPrice() of PriceFeed.sol and sendCJPY() of Pool.sol`, async function () {
      await (await yamato.connect(accounts[1]).sweep()).wait();

      expect(mockFeed.fetchPrice).to.have.called;
      expect(mockPool.sendCJPY).to.have.calledOnce;
      expect(mockPool.useSweepReserve).to.have.calledTwice;
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
      expect(afterValues[1]).to.eq("236363000000000000000000");
      expect(afterValues[2]).to.eq(MCR);
      expect(afterValues[3]).to.eq(RRR);
      expect(afterValues[4]).to.eq(SRR);
      expect(afterValues[5]).to.eq(GRR);
    });
  });

  describe("getIndivisualStates()", () => {
    let accounts;

    beforeEach(async () => {
      accounts = await ethers.getSigners();
    });

    it("should return correct values", async () => {
      const owner = await accounts[0].getAddress();

      const beforeValues = await yamato.getIndivisualStates(owner);

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
      const afterValues = await yamato.getIndivisualStates(owner);

      expect(afterValues[0]).to.eq("1000000000000000000");
      expect(afterValues[1]).to.eq("236363000000000000000000");
      expect(afterValues[2]).to.eq(true);
    });
  });
});
