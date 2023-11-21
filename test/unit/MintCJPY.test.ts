import { ethers } from "hardhat";
import { smock } from "@defi-wonderland/smock";
import chai, { expect } from "chai";
import { Signer, BigNumber } from "ethers";
import {
  takeSnapshot,
  SnapshotRestorer,
} from "@nomicfoundation/hardhat-network-helpers";
import { toERC20 } from "../param/helper";
import {
  ChainLinkMock,
  PriceFeedV3,
  FeePool,
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
  YMT,
  VeYMT,
  ScoreWeightController,
  YmtMinter,
  ScoreRegistry,
  Pool,
  ChainLinkMock__factory,
  PriceFeedV3__factory,
  FeePool__factory,
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
  YMT__factory,
  VeYMT__factory,
  ScoreWeightController__factory,
  YmtMinter__factory,
  ScoreRegistry__factory,
} from "../../typechain";
import { getProxy, getLinkedProxy } from "../../src/testUtil";
import { contractVersion } from "../param/version";

chai.use(smock.matchers);

describe("MintCJPY :: contract Yamato", () => {
  let ChainLinkEthUsd: ChainLinkMock;
  let ChainLinkUsdJpy: ChainLinkMock;
  let PriceFeed: PriceFeedV3;
  let CJPY: CJPY;
  let FeePool: FeePool;
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
  let ScoreWeightController: ScoreWeightController;
  let accounts: Signer[];
  let ownerAddress: string;
  let userAddress: string;
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

    FeePool = await getProxy<FeePool, FeePool__factory>(
      contractVersion["FeePool"],
      []
    );

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
    >(contractVersion["YamatoDepositor"], [Yamato.address], ["PledgeLib"]);

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

    YMT = await (<YMT__factory>await ethers.getContractFactory("YMT")).deploy();

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

    ScoreRegistry = await getProxy<ScoreRegistry, ScoreRegistry__factory>(
      contractVersion["ScoreRegistry"],
      [YmtMinter.address, Yamato.address]
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
    await (await CurrencyOS.addYamato(Yamato.address)).wait();
    await (await CJPY.setCurrencyOS(CurrencyOS.address)).wait();
  });

  beforeEach(async () => {
    snapshot = await takeSnapshot();
  });

  afterEach(async () => {
    await snapshot.restore();
  });

  describe("borrow()", function () {
    it(`should mint CJPY`, async function () {
      await (await PriceFeed.fetchPrice()).wait();
      const PRICE = await PriceFeed.lastGoodPrice();

      const MCR = BigNumber.from(130);
      const toCollateralize = 1;
      const toBorrow = PRICE.mul(toCollateralize)
        .mul(100)
        .div(MCR)
        .div(1e18 + "");
      await Yamato.deposit({ value: toERC20(toCollateralize + "") });

      const totalSupplyBefore = await CJPY.totalSupply();
      await Yamato.borrow(toERC20(toBorrow + ""));
      const totalSupplyAfter = await CJPY.totalSupply();

      expect(totalSupplyAfter).to.be.gt(totalSupplyBefore);

      const eoaBalance = await CJPY.balanceOf(await accounts[0].getAddress());
      expect(eoaBalance).to.be.lt(toERC20(toBorrow + ""));
      expect(eoaBalance).to.be.gt(toERC20(toBorrow.mul(79).div(100) + ""));

      const caBalance = await CJPY.balanceOf(Pool.address);
      expect(caBalance).to.be.lt(toERC20(toBorrow.mul(21).div(100) + ""));
      expect(caBalance).to.be.gt(0);

      expect(eoaBalance.add(caBalance)).to.eq(toBorrow.mul(1e18 + ""));
    });
  });
});
