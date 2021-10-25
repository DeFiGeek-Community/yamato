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
  Yamato__factory,
  FeePool__factory,
  YMT,
} from "../../typechain";
import { encode, toERC20 } from "../param/helper";
import { getFakeProxy } from "../../src/testUtil";

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

      yamato = await (<Yamato__factory>(
        await ethers.getContractFactory("Yamato", { libraries: { PledgeLib } })
      )).deploy(mockCjpyOS.address);

      /* BEGIN DIRTY-FIX
            !!TODO!!
            The code that this block contains is
            for avoiding bugs of smock, hardhat-ethers or ethers
            (I think ethers is suspicious.)
            and must be as following if there is no bug:
            ```
            mockPriorityRegistry = await smock.fake<PriorityRegistry>(
              priorityRegistryContractFactory
            );
            ```
        
            The bugs are that some of the hardhat-ethers methods, like getContractFactory,
            return wrong ethers objects, and the smock library can not handle that wrong object and raises an error.
            That reproduces when using library linking.
        
            The smock library falls in error when it runs the code following [this line](
            https://github.com/defi-wonderland/smock/blob/v2.0.7/src/factories/ethers-interface.ts#L22).
            This patch allows the function to return from [this line](
            https://github.com/defi-wonderland/smock/blob/v2.0.7/src/factories/ethers-interface.ts#L16)
            before falling error.
        
            */
      const priorityRegistryContract =
        await priorityRegistryContractFactory.deploy(yamato.address);
      await priorityRegistryContract.deployed();
      mockPriorityRegistry = await smock.fake<PriorityRegistry>(
        "PriorityRegistry"
      );
      /* END DIRTY-FIX */

      await (await yamato.setPool(mockPool.address)).wait();
      await (
        await yamato.setPriorityRegistry(mockPriorityRegistry.address)
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
});
