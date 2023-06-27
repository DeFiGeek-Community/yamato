import { ethers } from "hardhat";
import { FakeContract, smock } from "@defi-wonderland/smock";
import chai, { expect } from "chai";
import { Signer, BigNumber, Wallet } from "ethers";
import {
  CJPY,
  CurrencyOS,
  Pool,
  FeePool,
  PriceFeedV3,
  PriorityRegistryV6,
  PriorityRegistryV6__factory,
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
  YMT,
  Pool__factory,
} from "../../typechain";
import { encode, toERC20 } from "../param/helper";
import { getFakeProxy, getLinkedProxy, getProxy } from "../../src/testUtil";

chai.use(smock.matchers);

describe("story Events", function () {
  describe("contract Yamato", function () {
    let mockPool: FakeContract<Pool>;
    let mockFeePool: FakeContract<FeePool>;
    let mockFeed: FakeContract<PriceFeedV3>;
    let mockYMT: FakeContract<YMT>;
    let mockCJPY: FakeContract<CJPY>;
    let mockCurrencyOS: FakeContract<CurrencyOS>;
    let mockPriorityRegistry: FakeContract<PriorityRegistryV6>;
    let yamato: Yamato;
    let yamatoDepositor: YamatoDepositor;
    let yamatoBorrower: YamatoBorrower;
    let yamatoRepayer: YamatoRepayer;
    let yamatoWithdrawer: YamatoWithdrawer;
    let yamatoRedeemer: YamatoRedeemer;
    let yamatoSweeper: YamatoSweeper;
    let priorityRegistry: PriorityRegistryV6;
    let PRICE: BigNumber;
    let MCR: BigNumber;
    let accounts: Signer[];
    let ownerAddress: string;
    let toCollateralize: number;
    let toBorrow: BigNumber;

    beforeEach(async () => {
      accounts = await ethers.getSigners();
      ownerAddress = await accounts[0].getAddress();

      mockPool = await smock.fake<Pool>("Pool");
      mockFeePool = await smock.fake<FeePool>("FeePool");
      mockFeed = await smock.fake<PriceFeedV3>("PriceFeed");
      mockYMT = await smock.fake<YMT>("YMT");
      mockCJPY = await smock.fake<CJPY>("CJPY");
      mockCurrencyOS = await smock.fake<CurrencyOS>("CurrencyOS");

      const PledgeLib = (
        await (await ethers.getContractFactory("PledgeLib")).deploy()
      ).address;
      const priorityRegistryContractFactory = <PriorityRegistryV6__factory>(
        await ethers.getContractFactory("PriorityRegistry", {
          libraries: { PledgeLib },
        })
      );

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

      yamatoRepayer = await getLinkedProxy<
        YamatoRepayer,
        YamatoRepayer__factory
      >("YamatoRepayer", [yamato.address], ["PledgeLib"]);

      yamatoWithdrawer = await getLinkedProxy<
        YamatoWithdrawer,
        YamatoWithdrawer__factory
      >("YamatoWithdrawer", [yamato.address], ["PledgeLib"]);

      yamatoRedeemer = await getLinkedProxy<
        YamatoRedeemer,
        YamatoRedeemer__factory
      >("YamatoRedeemer", [yamato.address], ["PledgeLib"]);

      yamatoSweeper = await getLinkedProxy<
        YamatoSweeper,
        YamatoSweeper__factory
      >("YamatoSweeper", [yamato.address], ["PledgeLib"]);

      mockPriorityRegistry = await getFakeProxy<PriorityRegistryV6>(
        "PriorityRegistryV6"
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

      PRICE = BigNumber.from(260000).mul(1e18 + "");
      MCR = BigNumber.from(130);

      mockPool.depositRedemptionReserve.returns(0);
      mockPool.depositSweepReserve.returns(0);
      mockPool.sendETH.returns(0);
      mockFeed.fetchPrice.returns(PRICE);
      mockFeed.lastGoodPrice.returns(PRICE);
      mockPool.redemptionReserve.returns(1);
      mockPool.sweepReserve.returns(
        BigNumber.from("99999999000000000000000000")
      );
      mockPriorityRegistry.yamato.returns(yamato.address);
      mockPriorityRegistry.pledgeLength.returns(2);
      mockPriorityRegistry.upsert.returns(0);
      mockPriorityRegistry.remove.returns(0);
      mockPriorityRegistry.LICR.returns(1);
      mockPriorityRegistry.rankedQueueNextout.returns(0);
      mockPriorityRegistry.rankedQueueTotalLen.returns(0);
      mockPriorityRegistry.getRankedQueue.returns(ethers.constants.AddressZero);
      mockPriorityRegistry.bulkUpsert.returns(Array(100).fill(0));

      toCollateralize = 1;
      toBorrow = PRICE.mul(toCollateralize)
        .mul(100)
        .div(MCR)
        .div(1e18 + "");

      mockCJPY.balanceOf.returns(PRICE.mul(toCollateralize).mul(100).div(MCR));
    });

    describe("event Deposited", function () {
      beforeEach(async () => {});
      it(`should be emitted with proper args.`, async function () {
        // address indexed sender, uint256 ethAmount
        await expect(
          yamato.deposit({ value: toERC20(toCollateralize + "") })
        ).to.emit(yamato, "Deposited");
      });
    });

    describe("event Borrowed", function () {
      beforeEach(async () => {
        await (
          await yamato.deposit({ value: toERC20(toCollateralize + "") })
        ).wait();
      });
      it(`should be emitted with proper args.`, async function () {
        // address indexed sender, uint256 cjpyAmount, uint256 fee
        await expect(yamato.borrow(toERC20(toBorrow + ""))).to.emit(
          yamato,
          "Borrowed"
        ); //.withArgs()
      });
    });

    describe("event Repaid", function () {
      beforeEach(async () => {
        await (
          await yamato.deposit({ value: toERC20(toCollateralize + "") })
        ).wait();
        await (await yamato.borrow(toERC20(toBorrow + ""))).wait();
      });
      it(`should be emitted with proper args.`, async function () {
        // address indexed sender, uint256 cjpyAmount
        await expect(yamato.repay(toERC20(toBorrow.div(2) + ""))).to.emit(
          yamato,
          "Repaid"
        ); //.withArgs()
      });
    });

    describe("event Withdrawn", function () {
      beforeEach(async () => {
        await (
          await yamato.deposit({ value: toERC20(toCollateralize + "") })
        ).wait();
      });
      it(`should be emitted with proper args.`, async function () {
        // address indexed sender, uint256 ethAmount
        await expect(
          yamato.withdraw(toERC20(toCollateralize / 100 + ""))
        ).to.emit(yamato, "Withdrawn"); //.withArgs()
      });
    });

    describe("event Redeemed", function () {
      beforeEach(async () => {
        await (
          await yamato
            .connect(accounts[0])
            .deposit({ value: toERC20(toCollateralize * 1.1 + "") })
        ).wait();
        await (
          await yamato.connect(accounts[0]).borrow(toERC20(toBorrow + ""))
        ).wait();
        await (
          await yamato
            .connect(accounts[1])
            .deposit({ value: toERC20(toCollateralize + "") })
        ).wait();
        await (
          await yamato.connect(accounts[1]).borrow(toERC20(toBorrow + ""))
        ).wait();
        mockCJPY.balanceOf.returns(PRICE.mul(10));
        mockFeed.fetchPrice.returns(PRICE.div(2));
        mockFeed.lastGoodPrice.returns(PRICE.div(2));
        mockPriorityRegistry.rankedQueuePop.returns(
          await accounts[1].getAddress()
        );
      });
      it(`should be emitted with proper args for Redeemed.`, async function () {
        // address indexed sender, uint256 cjpyAmount, uint256 ethAmount, uint256 price, boolean isCoreRedemption, uint256 gasCompensationAmount, address[] pledgesOwner
        await expect(yamato.redeem(1, false)).to.emit(yamato, "Redeemed");
      });
      it(`should be emitted with proper args for RedeemedMeta.`, async function () {
        // address indexed sender, uint256 cjpyAmount, uint256 ethAmount, uint256 price, boolean isCoreRedemption, uint256 gasCompensationAmount, address[] pledgesOwner
        await expect(yamato.redeem(toERC20(toBorrow + ""), false)).to.emit(
          yamato,
          "RedeemedMeta"
        );
      });
    });

    describe("event Swept", function () {
      beforeEach(async () => {
        await (
          await yamato
            .connect(accounts[0])
            .deposit({ value: toERC20(toCollateralize * 1.1 + "") })
        ).wait();
        await (
          await yamato.connect(accounts[0]).borrow(toERC20(toBorrow + ""))
        ).wait();
        await (
          await yamato
            .connect(accounts[1])
            .deposit({ value: toERC20(toCollateralize * 10 + "") })
        ).wait();
        await (
          await yamato
            .connect(accounts[1])
            .borrow(toERC20(toBorrow.mul(10) + ""))
        ).wait();
        await (
          await yamato
            .connect(accounts[2])
            .deposit({ value: toERC20(toCollateralize * 0.1 + "") })
        ).wait();
        await (
          await yamato
            .connect(accounts[2])
            .borrow(toERC20(toBorrow.div(10) + ""))
        ).wait();

        mockCJPY.balanceOf.returns(PRICE.mul(10));
        mockFeed.fetchPrice.returns(PRICE.div(2));
        mockFeed.lastGoodPrice.returns(PRICE.div(2));
        mockPriorityRegistry.rankedQueuePop.returnsAtCall(
          0,
          await accounts[1].getAddress()
        );
        mockPriorityRegistry.rankedQueuePop
          .whenCalledWith(0)
          .returns(await accounts[2].getAddress());
        await (await yamato.redeem(toERC20(toBorrow + ""), false)).wait();
      });
      it(`should be emitted with proper args.`, async function () {
        // address indexed sender, uint256 cjpyAmount, uint256 gasCompensationAmount, address[] pledgesOwner
        mockPriorityRegistry.rankedQueueLen.whenCalledWith(0).returns(1);
        await expect(yamato.sweep()).to.emit(yamato, "Swept");
      });
    });
  });

  describe("contract Pool", function () {
    let pool: Pool;
    let yamatoDummy: YamatoDummy;
    let mockCJPY: FakeContract<CJPY>;
    let mockFeePool: FakeContract<FeePool>;
    let mockFeed: FakeContract<PriceFeedV3>;
    let mockCurrencyOS: FakeContract<CurrencyOS>;
    let mockYamatoDepositor: FakeContract<YamatoDepositor>;
    let mockYamatoBorrower: FakeContract<YamatoBorrower>;
    let mockYamatoRepayer: FakeContract<YamatoRepayer>;
    let mockYamatoWithdrawer: FakeContract<YamatoWithdrawer>;
    let mockYamatoRedeemer: FakeContract<YamatoRedeemer>;
    let mockYamatoSweeper: FakeContract<YamatoSweeper>;
    let accounts;

    beforeEach(async () => {
      accounts = await ethers.getSigners();
      mockCJPY = await smock.fake<CJPY>("CJPY");
      mockCJPY.transfer.returns(0);

      mockFeePool = await getFakeProxy<FeePool>("FeePool");
      mockFeed = await getFakeProxy<PriceFeedV3>("PriceFeed");
      mockCurrencyOS = await smock.fake<CurrencyOS>("CurrencyOS");
      mockCurrencyOS.priceFeed.returns(mockFeed.address);
      mockCurrencyOS.feePool.returns(mockFeePool.address);
      mockCurrencyOS.currency.returns(mockCJPY.address);

      const PledgeLib = (
        await (await ethers.getContractFactory("PledgeLib")).deploy()
      ).address;

      mockYamatoDepositor = await getFakeProxy<YamatoDepositor>(
        "YamatoDepositor"
      );
      mockYamatoBorrower = await getFakeProxy<YamatoBorrower>("YamatoBorrower");
      mockYamatoRepayer = await getFakeProxy<YamatoRepayer>("YamatoRepayer");
      mockYamatoWithdrawer = await getFakeProxy<YamatoWithdrawer>(
        "YamatoWithdrawer"
      );
      mockYamatoRedeemer = await getFakeProxy<YamatoRedeemer>("YamatoRedeemer");
      mockYamatoSweeper = await getFakeProxy<YamatoSweeper>("YamatoSweeper");
      let yamatoDepositor: YamatoDepositor;

      yamatoDummy = await (<YamatoDummy__factory>(
        await ethers.getContractFactory("YamatoDummy", {
          libraries: { PledgeLib },
        })
      )).deploy(mockCurrencyOS.address);

      mockYamatoDepositor.yamato.returns(yamatoDummy.address);
      mockYamatoBorrower.yamato.returns(yamatoDummy.address);
      mockYamatoRepayer.yamato.returns(yamatoDummy.address);
      mockYamatoWithdrawer.yamato.returns(yamatoDummy.address);
      mockYamatoRedeemer.yamato.returns(yamatoDummy.address);
      mockYamatoSweeper.yamato.returns(yamatoDummy.address);

      pool = await getProxy<Pool, Pool__factory>("Pool", [yamatoDummy.address]);

      await (await yamatoDummy.setPool(pool.address)).wait();
    });
    describe("event RedemptionReserveDeposited", function () {
      it(`should be emitted`, async function () {
        await expect(
          yamatoDummy.bypassDepositRedemptionReserve(BigNumber.from(1e18 + ""))
        ).to.emit(pool, "RedemptionReserveDeposited");
      });
    });
    describe("event RedemptionReserveUsed", function () {
      it(`should be emitted`, async function () {
        await (
          await yamatoDummy.bypassDepositRedemptionReserve(
            BigNumber.from(1e18 + "")
          )
        ).wait();
        await expect(
          yamatoDummy.bypassUseRedemptionReserve(BigNumber.from(1e18 + ""))
        ).to.emit(pool, "RedemptionReserveUsed");
      });
    });
    describe("event SweepReserveDeposited", function () {
      it(`should be emitted`, async function () {
        await expect(
          yamatoDummy.bypassDepositSweepReserve(BigNumber.from(1e18 + ""))
        ).to.emit(pool, "SweepReserveDeposited");
      });
    });
    describe("event SweepReserveUsed", function () {
      it(`should be emitted`, async function () {
        await (
          await yamatoDummy.bypassDepositSweepReserve(BigNumber.from(1e18 + ""))
        ).wait();
        await expect(
          yamatoDummy.bypassUseSweepReserve(BigNumber.from(1e18 + ""))
        ).to.emit(pool, "SweepReserveUsed");
      });
    });
    describe("event ETHLocked", function () {
      it(`should be emitted`, async function () {
        await expect(
          yamatoDummy.bypassReceive({ value: BigNumber.from(1e18 + "") })
        ).to.emit(pool, "ETHLocked");
      });
    });
    describe("event ETHSent", function () {
      it(`should be emitted`, async function () {
        await (
          await yamatoDummy.bypassReceive({ value: BigNumber.from(1e18 + "") })
        ).wait();
        await expect(
          yamatoDummy.bypassSendETH(
            await accounts[0].getAddress(),
            BigNumber.from(1e18 + "")
          )
        ).to.emit(pool, "ETHSent");
      });
    });
    describe("event CurrencySent", function () {
      it(`should be emitted`, async function () {
        await expect(
          yamatoDummy.bypassSendCurrency(
            await accounts[0].getAddress(),
            BigNumber.from(1e18 + "")
          )
        ).to.emit(pool, "CurrencySent");
      });
    });
  });
});
