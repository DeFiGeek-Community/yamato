import { ethers } from "hardhat";
import { smock } from "@defi-wonderland/smock";
import chai, { expect } from "chai";
import { Signer, BigNumber } from "ethers";
import {
  time,
  takeSnapshot,
  SnapshotRestorer,
} from "@nomicfoundation/hardhat-network-helpers";
import { toERC20 } from "../param/helper";
import {
  ChainLinkMock,
  PriceFeedV3,
  FeePoolV2,
  CurrencyOS,
  CJPY,
  YamatoV4,
  YamatoDepositor,
  YamatoBorrower,
  YamatoRepayer,
  YamatoWithdrawer,
  YamatoRedeemer,
  YamatoSweeper,
  PriorityRegistry,
  YmtVesting,
  YMT,
  VeYMT,
  ScoreWeightController,
  YmtMinter,
  ScoreRegistry,
  Pool,
  SameBlockClient,
  ChainLinkMock__factory,
  PriceFeedV3__factory,
  FeePoolV2__factory,
  CurrencyOS__factory,
  CJPY__factory,
  YamatoV4__factory,
  YamatoDepositor__factory,
  YamatoBorrower__factory,
  YamatoRepayer__factory,
  YamatoWithdrawer__factory,
  YamatoRedeemer__factory,
  YamatoSweeper__factory,
  Pool__factory,
  PriorityRegistry__factory,
  YmtVesting__factory,
  YMT__factory,
  VeYMT__factory,
  ScoreWeightController__factory,
  YmtMinter__factory,
  ScoreRegistry__factory,
  SameBlockClient__factory,
} from "../../typechain";
import { getProxy, getLinkedProxy } from "../../src/testUtil";
import { upgradeProxy } from "../../src/upgradeUtil";
import { contractVersion } from "../param/version";

chai.use(smock.matchers);

describe("FlashLock :: contract Yamato", () => {
  let ChainLinkEthUsd: ChainLinkMock;
  let ChainLinkUsdJpy: ChainLinkMock;
  let PriceFeed: PriceFeedV3;
  let CJPY: CJPY;
  let FeePool: FeePoolV2;
  let CurrencyOS: CurrencyOS;
  let Yamato: YamatoV4;
  let YamatoDepositor: YamatoDepositor;
  let YamatoBorrower: YamatoBorrower;
  let YamatoRepayer: YamatoRepayer;
  let YamatoWithdrawer: YamatoWithdrawer;
  let YamatoRedeemer: YamatoRedeemer;
  let YamatoSweeper: YamatoSweeper;
  let Pool: Pool;
  let PriorityRegistry: PriorityRegistry;
  let ScoreRegistry: ScoreRegistry;
  let YmtMinter: YmtMinter;
  let veYMT: VeYMT;
  let YMT: YMT;
  let YmtVesting: YmtVesting;
  let ScoreWeightController: ScoreWeightController;
  let accounts: Signer[];
  let ownerAddress: string;
  let userAddress: string;
  let SameBlockClient: SameBlockClient;

  let snapshot: SnapshotRestorer;

  before(async () => {
    accounts = await ethers.getSigners();
    ownerAddress = await accounts[0].getAddress();
    userAddress = await accounts[1].getAddress();

    ChainLinkEthUsd = await (<ChainLinkMock__factory>(
      await ethers.getContractFactory("ChainLinkMock")
    )).deploy("ETH/USD");
    ChainLinkUsdJpy = await (<ChainLinkMock__factory>(
      await ethers.getContractFactory("ChainLinkMock")
    )).deploy("JPY/USD");

    await (
      await ChainLinkEthUsd.connect(accounts[0]).simulatePriceMove({
        gasLimit: 200000,
      })
    ).wait();
    await (
      await ChainLinkUsdJpy.connect(accounts[0]).simulatePriceMove({
        gasLimit: 200000,
      })
    ).wait();
    await (
      await ChainLinkEthUsd.connect(accounts[0]).simulatePriceMove({
        gasLimit: 200000,
      })
    ).wait();
    await (
      await ChainLinkUsdJpy.connect(accounts[0]).simulatePriceMove({
        gasLimit: 200000,
      })
    ).wait();

    PriceFeed = await getProxy<PriceFeedV3, PriceFeedV3__factory>(
      contractVersion["PriceFeed"],
      [ChainLinkEthUsd.address, ChainLinkUsdJpy.address]
    );

    CJPY = await (<CJPY__factory>(
      await ethers.getContractFactory("CJPY")
    )).deploy();

    FeePool = await getProxy<FeePoolV2, FeePoolV2__factory>("FeePool", [], 1);
    FeePool = await upgradeProxy(FeePool.address, "FeePoolV2", undefined, {
      call: { fn: "initializeV2", args: [await time.latest()] },
    });

    CurrencyOS = await getProxy<CurrencyOS, CurrencyOS__factory>(
      contractVersion["CurrencyOS"],
      [CJPY.address, PriceFeed.address, FeePool.address]
    );

    Yamato = await getLinkedProxy<YamatoV4, YamatoV4__factory>(
      contractVersion["Yamato"],
      [CurrencyOS.address],
      ["PledgeLib"]
    );

    YamatoDepositor = await getLinkedProxy<
      YamatoDepositor,
      YamatoDepositor__factory
    >(contractVersion["YamatoDepositor"], [Yamato.address], ["PledgeLib"]);

    YamatoBorrower = await getLinkedProxy<
      YamatoBorrower,
      YamatoBorrower__factory
    >(contractVersion["YamatoBorrower"], [Yamato.address], ["PledgeLib"]);

    YamatoRepayer = await getLinkedProxy<YamatoRepayer, YamatoRepayer__factory>(
      contractVersion["YamatoRepayer"],
      [Yamato.address],
      ["PledgeLib"]
    );

    YamatoWithdrawer = await getLinkedProxy<
      YamatoWithdrawer,
      YamatoWithdrawer__factory
    >(contractVersion["YamatoWithdrawer"], [Yamato.address], ["PledgeLib"]);

    YamatoRedeemer = await getLinkedProxy<
      YamatoRedeemer,
      YamatoRedeemer__factory
    >(contractVersion["YamatoRedeemer"], [Yamato.address], ["PledgeLib"]);

    YamatoSweeper = await getLinkedProxy<YamatoSweeper, YamatoSweeper__factory>(
      contractVersion["YamatoSweeper"],
      [Yamato.address],
      ["PledgeLib"]
    );

    Pool = await getProxy<Pool, Pool__factory>(contractVersion["Pool"], [
      Yamato.address,
    ]);

    PriorityRegistry = await getLinkedProxy<
      PriorityRegistry,
      PriorityRegistry__factory
    >(contractVersion["PriorityRegistry"], [Yamato.address], ["PledgeLib"]);

    YmtVesting = await (<YmtVesting__factory>(
      await ethers.getContractFactory("YmtVesting")
    )).deploy();

    YMT = await (<YMT__factory>await ethers.getContractFactory("YMT")).deploy(
      YmtVesting.address,
      ownerAddress
    );

    veYMT = await (<VeYMT__factory>(
      await ethers.getContractFactory("veYMT")
    )).deploy(YMT.address);

    ScoreWeightController = await getProxy<
      ScoreWeightController,
      ScoreWeightController__factory
    >(contractVersion["ScoreWeightController"], [YMT.address, veYMT.address]);

    YmtMinter = await getProxy<YmtMinter, YmtMinter__factory>(
      contractVersion["YmtMinter"],
      [YMT.address, ScoreWeightController.address]
    );

    ScoreRegistry = await getLinkedProxy<ScoreRegistry, ScoreRegistry__factory>(
      contractVersion["ScoreRegistry"],
      [YmtMinter.address, Yamato.address],
      ["PledgeLib"]
    );

    await (
      await Yamato.setDeps(
        YamatoDepositor.address,
        YamatoBorrower.address,
        YamatoRepayer.address,
        YamatoWithdrawer.address,
        YamatoRedeemer.address,
        YamatoSweeper.address,
        Pool.address,
        PriorityRegistry.address
      )
    ).wait();
    await (await Yamato.setScoreRegistry(ScoreRegistry.address)).wait();
    await YMT.setMinter(YmtMinter.address);
    await (await CurrencyOS.addYamato(Yamato.address)).wait();
    await (await CJPY.setCurrencyOS(CurrencyOS.address)).wait();

    SameBlockClient = await (<SameBlockClient__factory>(
      await ethers.getContractFactory("SameBlockClient")
    )).deploy(Yamato.address);

    await (await PriceFeed.fetchPrice()).wait();
  });

  beforeEach(async () => {
    snapshot = await takeSnapshot();
  });

  afterEach(async () => {
    await snapshot.restore();
  });

  describe("depositAndBorrow()", function () {
    it(`should be reverted`, async function () {
      const PRICE = await PriceFeed.lastGoodPrice();
      const MCR = BigNumber.from(130);
      const toCollateralize = 1;
      const toBorrow = PRICE.mul(toCollateralize)
        .mul(100)
        .div(MCR)
        .div(1e18 + "");

      await expect(
        SameBlockClient.depositAndBorrow(toERC20(toBorrow + ""), {
          value: toERC20(toCollateralize + ""),
        })
      ).to.be.revertedWith("Those can't be called in the same block.");
    });
  });

  describe("borrowAndWithdraw()", function () {
    it(`should be reverted`, async function () {
      const PRICE = await PriceFeed.lastGoodPrice();
      const MCR = BigNumber.from(130);
      const toCollateralize = 1;
      const toBorrow = PRICE.mul(toCollateralize)
        .mul(100)
        .div(MCR)
        .div(1e18 + "");

      // Note: Align signer with following execution
      await (
        await SameBlockClient.depositFromClient({
          value: toERC20(toCollateralize * 3 + ""),
        })
      ).wait();

      await expect(
        SameBlockClient.borrowAndWithdraw(
          toERC20(toBorrow + ""),
          toERC20(toCollateralize + "")
        )
      ).to.be.revertedWith("Those can't be called in the same block.");
    });
  });

  describe("depositAndWithdraw()", function () {
    it(`should be reverted`, async function () {
      const PRICE = await PriceFeed.lastGoodPrice();
      const MCR = BigNumber.from(130);
      const toCollateralize = 1;
      const toBorrow = PRICE.mul(toCollateralize)
        .mul(100)
        .div(MCR)
        .div(1e18 + "");

      await expect(
        SameBlockClient.depositAndWithdraw(toERC20(toCollateralize + ""), {
          value: toERC20(toCollateralize + ""),
        })
      ).to.be.revertedWith("Those can't be called in the same block.");
    });
  });

  describe("depositAndBorrowAndWithdraw()", function () {
    it(`should be reverted`, async function () {
      const PRICE = await PriceFeed.lastGoodPrice();
      const MCR = BigNumber.from(130);
      const toCollateralize = 1;
      const toBorrow = PRICE.mul(toCollateralize)
        .mul(100)
        .div(MCR)
        .div(1e18 + "");

      await expect(
        SameBlockClient.depositAndBorrowAndWithdraw(
          toERC20(toBorrow + ""),
          toERC20(toCollateralize + ""),
          { value: toERC20(toCollateralize + "") }
        )
      ).to.be.revertedWith("Those can't be called in the same block.");
    });
  });
});
