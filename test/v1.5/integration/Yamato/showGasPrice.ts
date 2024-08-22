import { ethers } from "hardhat";
import { FakeContract, smock } from "@defi-wonderland/smock";
import chai, { expect } from "chai";
import { Signer, BigNumber, Wallet, ContractReceipt } from "ethers";
import {
  time,
  takeSnapshot,
  SnapshotRestorer,
} from "@nomicfoundation/hardhat-network-helpers";
import { toERC20 } from "../../../param/helper";
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
  PriorityRegistryV6,
  YmtVesting,
  YMT,
  VeYMT,
  ScoreWeightController,
  YmtMinter,
  ScoreRegistry,
  PoolV2,
  ChainLinkMock__factory,
  PriceFeedV3__factory,
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
  FeePoolV2__factory,
  PriorityRegistryV6__factory,
  YmtVesting__factory,
  YMT__factory,
  VeYMT__factory,
  ScoreWeightController__factory,
  YmtMinter__factory,
  ScoreRegistry__factory,
} from "../../../../typechain";
import { getProxy, getLinkedProxy } from "../../../../src/testUtil";
import { upgradeProxy } from "../../../../src/upgradeUtil";
import { contractVersion } from "../../../param/version";

chai.use(smock.matchers);

// 外部で価格を管理する変数
let ethUsdRate = 3000; // ETHのUSD価格の初期値
let cjpyUsdRate = 0.0091; // CJPYのUSD価格の初期値（例として）

// トランザクションコストを計算し、ログに出力する関数
async function calculateAndLogTransactionCost(
  tx: ContractReceipt,
  gasPriceGwei: string
) {
  // ガス使用量
  const gasUsed = tx.gasUsed;

  // ガス価格をEther単位に変換
  const gasPrice = ethers.utils.parseUnits(gasPriceGwei, "gwei");

  // ガス代の計算
  const cost = gasUsed.mul(gasPrice);

  // ガス代をETHで表示
  const costInEth = ethers.utils.formatEther(cost);

  // 最後のイベントからcurrencyAmountとgasCompensationAmountを取得
  const lastEvent = tx.events[tx.events.length - 1];
  const currencyAmount = BigNumber.from(lastEvent.args.currencyAmount);
  const gasCompensationAmount = BigNumber.from(
    lastEvent.args.gasCompensationAmount
  );

  // currencyAmountとgasCompensationAmountをETHで表示し、USD価格に変換
  const currencyAmountInUsd =
    parseFloat(ethers.utils.formatEther(currencyAmount)) * cjpyUsdRate;
  const gasCompensationAmountInUsd =
    parseFloat(ethers.utils.formatEther(gasCompensationAmount)) * cjpyUsdRate;
  const costInUsd = parseFloat(costInEth) * ethUsdRate;

  console.log(
    `Transaction cost: ${costInEth} ETH (${costInUsd.toFixed(6)} USD)`
  );
  console.log(`Currency Amount: ${currencyAmountInUsd.toFixed(6)} USD`);
  console.log(
    `Gas Compensation Amount: ${gasCompensationAmountInUsd.toFixed(6)} USD`
  );
}

describe("Gas Price Calculation and Transaction Cost Logging", () => {
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
  // let Pool: Pool;
  let mockPool: FakeContract<PoolV2>;
  let PriorityRegistry: PriorityRegistryV6;
  let ScoreRegistry: ScoreRegistry;
  let YmtMinter: YmtMinter;
  let veYMT: VeYMT;
  let YMT: YMT;
  let YmtVesting: YmtVesting;
  let ScoreWeightController: ScoreWeightController;
  let accounts: Signer[];
  let ownerAddress: string;
  let userAddress: string;

  let snapshot: SnapshotRestorer;

  async function checkCJPYBalance(address: string) {
    // 指定されたアドレスのCJPY残高を取得
    const balance = await CJPY.balanceOf(address);
    // BigNumber型の残高をEther単位に変換
    const formattedBalance = ethers.utils.formatEther(balance);
    // コンソールに残高を出力
    console.log(`CJPY Balance of ${address}: ${formattedBalance} CJPY`);
  }

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

    await (await ChainLinkEthUsd.setLastPrice(400000000000)).wait(); //dec8
    await (await ChainLinkUsdJpy.setLastPrice(877000)).wait();

    PriceFeed = await getProxy<PriceFeedV3, PriceFeedV3__factory>(
      contractVersion["PriceFeed"],
      [ChainLinkEthUsd.address, ChainLinkUsdJpy.address]
    );
    await (await PriceFeed.fetchPrice()).wait();

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

    const PledgeLib = (
      await (await ethers.getContractFactory("PledgeLib")).deploy()
    ).address;

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

    // Pool = await getProxy<Pool, Pool__factory>(contractVersion["Pool"], [
    //   Yamato.address,
    // ]);
    mockPool = await smock.fake<PoolV2>(contractVersion["Pool"]);

    PriorityRegistry = await getLinkedProxy<
      PriorityRegistryV6,
      PriorityRegistryV6__factory
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
        mockPool.address,
        PriorityRegistry.address
      )
    ).wait();
    await (await Yamato.setScoreRegistry(ScoreRegistry.address)).wait();

    await (await CurrencyOS.addYamato(Yamato.address)).wait();
    await (await CJPY.setCurrencyOS(CurrencyOS.address)).wait();

    mockPool.redemptionReserve.returns(1);
    mockPool.sweepReserve.returns(toERC20(10000000 + ""));
  });

  beforeEach(async () => {
    snapshot = await takeSnapshot();
  });

  afterEach(async () => {
    await snapshot.restore();
  });

  describe("sweep()", function () {
    const MCR = BigNumber.from(130);
    let toCollateralize;
    let toBorrow;
    let redeemer;
    let redeemee;
    let anotherRedeemee;
    let yetAnotherRedeemee;

    // depositとborrowに使用する値の配列を用意
    const depositAndBorrowValues = [
      { deposit: "0.4", borrow: "100000" },
      { deposit: "0.8", borrow: "200000" },
      { deposit: "1.6", borrow: "400000" },
      { deposit: "2.4", borrow: "600000" },
      { deposit: "3.2", borrow: "800000" },
    ];

    beforeEach(async () => {
      redeemer = accounts[0];
      redeemee = accounts[1];

      await checkCJPYBalance(redeemer.address);
      await Yamato.connect(redeemer).deposit({
        value: toERC20("2000"),
      });
      await Yamato.connect(redeemer).borrow(toERC20("300000000"));

      await (
        await CJPY.connect(redeemer).transfer(
          mockPool.address,
          toERC20("100000000")
        )
      ).wait();
    });

    it(`should run full sweep`, async function () {
      for (const value of depositAndBorrowValues) {
        await (await ChainLinkEthUsd.setLastPrice(400000000000)).wait(); //dec8
        await (await ChainLinkUsdJpy.setLastPrice(877000)).wait();

        for (var i = 1; i < 2; i++) {
          // depositとborrowの値の配列をループで処理
          await Yamato.connect(accounts[i]).deposit({
            value: toERC20(value.deposit),
          });
          await Yamato.connect(accounts[i]).borrow(toERC20(value.borrow));
        }

        /* Market Dump */
        await (await ChainLinkEthUsd.setLastPrice("204000000000")).wait(); //dec8
        await (await ChainLinkUsdJpy.setLastPrice(877000)).wait();

        await (
          await Yamato.connect(redeemer).redeem(toERC20("100000000"), false)
        ).wait();

        const poolCjpyBalanceBefore = await CJPY.balanceOf(mockPool.address);

        await checkCJPYBalance(mockPool.address);

        let tx1 = await (await Yamato.connect(redeemer).sweep()).wait();
        await calculateAndLogTransactionCost(tx1, "1");

        const sweptPledge = await Yamato.getPledge(redeemee.address);
        const poolCjpyBalanceAfter = await CJPY.balanceOf(mockPool.address);

        expect(poolCjpyBalanceAfter).to.be.lt(poolCjpyBalanceBefore);
        expect(sweptPledge.debt).to.equal(0);
        expect(sweptPledge.isCreated).to.be.false;
      }
    });
  });
});
