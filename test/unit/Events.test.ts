import { ethers } from "hardhat";
import { FakeContract, smock } from "@defi-wonderland/smock";
import chai, { expect } from "chai";
import { solidity } from "ethereum-waffle";
import { Signer, BigNumber, Wallet } from "ethers";
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
  Pool__factory,
} from "../../typechain";
import { encode, toERC20 } from "../param/helper";
import { getFakeProxy, getLinkedProxy } from "../../src/testUtil";

chai.use(smock.matchers);
chai.use(solidity);

describe("story Events", function () {
  describe("contract Yamato", function () {
    let mockPool: FakeContract<Pool>;
    let mockFeePool: FakeContract<FeePool>;
    let mockFeed: FakeContract<PriceFeed>;
    let mockYMT: FakeContract<YMT>;
    let mockCJPY: FakeContract<CJPY>;
    let mockCjpyOS: FakeContract<CjpyOS>;
    let mockPriorityRegistry: FakeContract<PriorityRegistry>;
    let yamato: Yamato;
    let yamatoHelper: YamatoHelper;
    let priorityRegistry: PriorityRegistry;
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
      mockFeed = await smock.fake<PriceFeed>("PriceFeed");
      mockYMT = await smock.fake<YMT>("YMT");
      mockCJPY = await smock.fake<CJPY>("CJPY");
      mockCjpyOS = await smock.fake<CjpyOS>("CjpyOS");

      const PledgeLib = (
        await (await ethers.getContractFactory("PledgeLib")).deploy()
      ).address;
      const priorityRegistryContractFactory = <PriorityRegistry__factory>(
        await ethers.getContractFactory("PriorityRegistry", {
          libraries: { PledgeLib },
        })
      );

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

      mockPriorityRegistry = await getFakeProxy<PriorityRegistry>(
        "PriorityRegistry"
      );

      await (await yamatoHelper.setPool(mockPool.address)).wait();
      await (
        await yamatoHelper.setPriorityRegistry(mockPriorityRegistry.address)
      ).wait();
      await (await yamato.setYamatoHelper(yamatoHelper.address)).wait();

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
      mockPool.sweepReserve.returns(
        BigNumber.from("99999999000000000000000000")
      );
      mockPriorityRegistry.yamato.returns(yamato.address);
      mockPriorityRegistry.pledgeLength.returns(2);
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

      toCollateralize = 1;
      toBorrow = PRICE.mul(toCollateralize)
        .mul(100)
        .div(MCR)
        .div(1e18 + "");
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
        mockFeed.fetchPrice.returns(PRICE.div(2));
        mockFeed.lastGoodPrice.returns(PRICE.div(2));
      });
      it(`should be emitted with proper args.`, async function () {
        // address indexed sender, uint256 cjpyAmount, uint256 ethAmount, uint256 price, boolean isCoreRedemption, uint256 gasCompensationAmount, address[] pledgesOwner
        await expect(yamato.redeem(toERC20(toBorrow + ""), false)).to.emit(
          yamato,
          "Redeemed"
        );
      });
      it(`should be emitted with proper args.`, async function () {
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
            .deposit({ value: toERC20(toCollateralize + "") })
        ).wait();
        await (
          await yamato.connect(accounts[1]).borrow(toERC20(toBorrow + ""))
        ).wait();
        mockFeed.fetchPrice.returns(PRICE.div(2));
        mockFeed.lastGoodPrice.returns(PRICE.div(2));
        await (await yamato.redeem(toERC20(toBorrow + ""), false)).wait();
      });
      it(`should be emitted with proper args.`, async function () {
        // address indexed sender, uint256 cjpyAmount, uint256 gasCompensationAmount, address[] pledgesOwner
        await expect(yamato.sweep()).to.emit(yamato, "Swept");
      });
    });
  });

  describe("contract Pool", function () {
    let pool: Pool;
    let yamatoDummy: YamatoDummy;
    let mockCJPY: FakeContract<CJPY>;
    let mockFeePool: FakeContract<FeePool>;
    let mockFeed: FakeContract<PriceFeed>;
    let mockCjpyOS: FakeContract<CjpyOS>;
    let mockYamatoHelper: FakeContract<YamatoHelper>;
    let accounts;

    beforeEach(async () => {
      accounts = await ethers.getSigners();
      mockCJPY = await smock.fake<CJPY>("CJPY");
      mockCJPY.transfer.returns(0);

      mockFeePool = await getFakeProxy<FeePool>("FeePool");
      mockFeed = await getFakeProxy<PriceFeed>("PriceFeed");
      mockCjpyOS = await smock.fake<CjpyOS>("CjpyOS");
      mockCjpyOS.feed.returns(mockFeed.address);
      mockCjpyOS.feePool.returns(mockFeePool.address);
      mockCjpyOS.currency.returns(mockCJPY.address);

      const PledgeLib = (
        await (await ethers.getContractFactory("PledgeLib")).deploy()
      ).address;

      mockYamatoHelper = await getFakeProxy<YamatoHelper>("YamatoHelper");

      yamatoDummy = await (<YamatoDummy__factory>(
        await ethers.getContractFactory("YamatoDummy", {
          libraries: { PledgeLib },
        })
      )).deploy(mockCjpyOS.address);

      mockYamatoHelper.yamato.returns(yamatoDummy.address);
      mockYamatoHelper.permitDeps.returns(true);

      pool = await (<Pool__factory>(
        await ethers.getContractFactory("Pool")
      )).deploy(mockYamatoHelper.address);

      await accounts[0].sendTransaction({
        to: pool.address,
        value: BigNumber.from(1e18 + ""),
      });

      await (await yamatoDummy.setPool(pool.address)).wait();

      mockYamatoHelper.getDeps.returns([
        yamatoDummy.address,
        mockYamatoHelper.address,
        pool.address,
      ]);
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
          yamatoDummy.bypassLockETH(BigNumber.from(1e18 + ""))
        ).to.emit(pool, "ETHLocked");
      });
    });
    describe("event ETHSent", function () {
      it(`should be emitted`, async function () {
        await (
          await yamatoDummy.bypassLockETH(BigNumber.from(1e18 + ""))
        ).wait();
        await expect(
          yamatoDummy.bypassSendETH(
            await accounts[0].getAddress(),
            BigNumber.from(1e18 + "")
          )
        ).to.emit(pool, "ETHSent");
      });
    });
    describe("event CJPYSent", function () {
      it(`should be emitted`, async function () {
        await expect(
          yamatoDummy.bypassSendCJPY(
            await accounts[0].getAddress(),
            BigNumber.from(1e18 + "")
          )
        ).to.emit(pool, "CJPYSent");
      });
    });
  });
});
