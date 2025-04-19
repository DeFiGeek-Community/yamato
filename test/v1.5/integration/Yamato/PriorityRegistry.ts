import { ethers,network } from "hardhat";
import { FakeContract, smock } from "@defi-wonderland/smock";
import chai, { expect } from "chai";
import { Signer, BigNumber, Wallet, ContractReceipt } from "ethers";
import {
  time,
  takeSnapshot,
  SnapshotRestorer,
  reset,
  setStorageAt,
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
  PriorityRegistryV7,
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
  PriorityRegistryV7__factory,
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

describe("PriorityRegistry consistency", () => {
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
  let Pool: FakeContract<PoolV2>;
  let PriorityRegistry: PriorityRegistryV7;
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

  function viewPledgeInfo(pledge,price) {
    console.log("pledge.coll",pledge.coll.toString());
    console.log("pledge.debt",pledge.debt.toString());
    console.log("pledge.priority",pledge.priority.toString());
    console.log("pledge calculated priority",pledge.coll.mul(price).div(pledge.debt).toString());
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

    await (await ChainLinkEthUsd.setLastPrice(17028700000000)).wait(); //dec8
    await (await ChainLinkUsdJpy.setLastPrice(1000000)).wait();

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

    Pool = await getProxy<Pool, Pool__factory>(contractVersion["Pool"], [
      Yamato.address,
    ]);

    PriorityRegistry = await getLinkedProxy<
      PriorityRegistryV7,
      PriorityRegistryV7__factory
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

    await (await CurrencyOS.addYamato(Yamato.address)).wait();
    await (await CJPY.setCurrencyOS(CurrencyOS.address)).wait();
  });

  beforeEach(async () => {
    snapshot = await takeSnapshot();
  });

  afterEach(async () => {
    await snapshot.restore();
  });

  describe("redeem()", function() {
    const depositAndBorrowValues = [
      { deposit: "0.1", borrow: "200" },
      { deposit: "10", borrow: "20100" },
      { deposit: "100", borrow: "20100" },
    ];
    const initPrice = BigNumber.from("2613").mul(BigNumber.from("100000000"));
    const dumpPrice = BigNumber.from("2591").mul(BigNumber.from("100000000"));
    const redeemAmount = toERC20("3");

    it(`should run redeem`, async function () {
      await (await ChainLinkEthUsd.setLastPrice(initPrice)).wait();
      await (await ChainLinkUsdJpy.setLastPrice(100000000)).wait();
      for (var i = 0; i < 3; i++) {
        // depositとborrowの値の配列をループで処理
        await Yamato.connect(accounts[i]).deposit({
          value: toERC20(depositAndBorrowValues[i].deposit),
        });
        let borrowAmount = toERC20(depositAndBorrowValues[i].borrow);
        if (i == 0) {
          borrowAmount = borrowAmount.add(BigNumber.from(1));
        }
        await Yamato.connect(accounts[i]).borrow(borrowAmount);
      }
      let pledge0;
      let pledge1;
      
      console.log("---pledge setup---");
      console.log("LICR",(await PriorityRegistry.LICR()).toNumber());
      pledge0 = await Yamato.getPledge(accounts[0].address);
      pledge1 = await Yamato.getPledge(accounts[1].address);
      console.log("---pledge0---");
      viewPledgeInfo(pledge0,await PriceFeed.getPrice());
      console.log("---pledge1---");
      viewPledgeInfo(pledge1,await PriceFeed.getPrice());

      console.log("---price dumped---");
      await (await ChainLinkEthUsd.setLastPrice(dumpPrice)).wait();
      await (await ChainLinkUsdJpy.setLastPrice(100000000)).wait();  
      await Yamato.connect(accounts[0]).repay(BigNumber.from(1));
      console.log("LICR",(await PriorityRegistry.LICR()).toNumber());
      pledge0 = await Yamato.getPledge(accounts[0].address);
      pledge1 = await Yamato.getPledge(accounts[1].address);
      console.log("---pledge0---");
      viewPledgeInfo(pledge0,await PriceFeed.getPrice());
      console.log("---pledge1---");
      viewPledgeInfo(pledge1,await PriceFeed.getPrice());

      console.log("---redeemed---");
      await Yamato.connect(accounts[2]).redeem(redeemAmount.add(BigNumber.from(1)),false);

      console.log("---after status---");
      console.log("LICR",(await PriorityRegistry.LICR()).toNumber());
      pledge0 = await Yamato.getPledge(accounts[0].address);
      pledge1 = await Yamato.getPledge(accounts[1].address);
      console.log("---pledge0---");
      viewPledgeInfo(pledge0,await PriceFeed.getPrice());
      console.log("---pledge1---");
      viewPledgeInfo(pledge1,await PriceFeed.getPrice());

      console.log("---next redeem revert---");
      await expect(Yamato.connect(accounts[2]).redeem(BigNumber.from(1),false)).to.be.reverted;

      console.log("---after status---");
      console.log("LICR",(await PriorityRegistry.LICR()).toNumber());
      pledge0 = await Yamato.getPledge(accounts[0].address);
      pledge1 = await Yamato.getPledge(accounts[1].address);
      console.log("---pledge0---");
      viewPledgeInfo(pledge0,await PriceFeed.getPrice());
      console.log("---pledge1---");
      viewPledgeInfo(pledge1,await PriceFeed.getPrice());

      console.log("---ICR force change---");
      await PriorityRegistry.setLICR(128);
      console.log("---next redeem not revert---");
      await expect(Yamato.connect(accounts[2]).redeem(BigNumber.from(1),false)).not.to.be.reverted;

      console.log("---after status---");
      pledge0 = await Yamato.getPledge(accounts[0].address);
      pledge1 = await Yamato.getPledge(accounts[1].address);
      console.log("---pledge0---");
      viewPledgeInfo(pledge0,await PriceFeed.getPrice());
      console.log("---pledge1---");
      viewPledgeInfo(pledge1,await PriceFeed.getPrice());
      console.log((await PriorityRegistry.LICR()).toNumber());

      for(var i=100;i<=300;i++) {
        const rankedQueueLen = (await PriorityRegistry.rankedQueueLen(i)).toNumber();
        if (rankedQueueLen > 0) {
          console.log("rankedQueue",i,rankedQueueLen);
        }
      }
    });

  });

  describe("redeem range", function() {
    const depositAndBorrowValues = [
      { deposit: "1", borrow: "1000" },
      { deposit: "1", borrow: "1300" },
    ];
    const initPrice = BigNumber.from("1300").mul(BigNumber.from("100000000"));

    it(`priority recheck`, async function () {
      await (await ChainLinkEthUsd.setLastPrice(initPrice)).wait();
      await (await ChainLinkUsdJpy.setLastPrice(100000000)).wait();

      await Yamato.connect(accounts[0]).deposit({
        value: toERC20(depositAndBorrowValues[0].deposit),
      });
      await Yamato.connect(accounts[0]).borrow(toERC20(depositAndBorrowValues[0].borrow));

      await (await ChainLinkEthUsd.setLastPrice(initPrice.mul(2))).wait();
      await (await ChainLinkUsdJpy.setLastPrice(100000000)).wait();

      await Yamato.connect(accounts[1]).deposit({
        value: toERC20(depositAndBorrowValues[1].deposit),
      });
      await Yamato.connect(accounts[1]).borrow(toERC20(depositAndBorrowValues[1].borrow));

      let pledge0;
      let pledge1;
      
      console.log("---pledge setup---");
      console.log("LICR",(await PriorityRegistry.LICR()).toNumber());
      pledge0 = await Yamato.getPledge(accounts[0].address);
      pledge1 = await Yamato.getPledge(accounts[1].address);
      console.log("---pledge0---");
      viewPledgeInfo(pledge0,await PriceFeed.getPrice());
      console.log("---pledge1---");
      viewPledgeInfo(pledge1,await PriceFeed.getPrice());


      console.log("---price dumped---");
      await (await ChainLinkEthUsd.setLastPrice(initPrice)).wait();
      await (await ChainLinkUsdJpy.setLastPrice(100000000)).wait();

      console.log("LICR",(await PriorityRegistry.LICR()).toNumber());
      pledge0 = await Yamato.getPledge(accounts[0].address);
      pledge1 = await Yamato.getPledge(accounts[1].address);
      console.log("---pledge0---");
      viewPledgeInfo(pledge0,await PriceFeed.getPrice());
      console.log("---pledge1---");
      viewPledgeInfo(pledge1,await PriceFeed.getPrice());

      await expect(Yamato.connect(accounts[0]).redeem(toERC20("900"),false)).to.be.reverted;

      console.log("LICR",(await PriorityRegistry.LICR()).toNumber());
      pledge0 = await Yamato.getPledge(accounts[0].address);
      pledge1 = await Yamato.getPledge(accounts[1].address);
      console.log("---pledge0---");
      viewPledgeInfo(pledge0,await PriceFeed.getPrice());
      console.log("---pledge1---");
      viewPledgeInfo(pledge1,await PriceFeed.getPrice());

      for(var i=100;i<=300;i++) {
        const rankedQueueLen = (await PriorityRegistry.rankedQueueLen(i)).toNumber();
        if (rankedQueueLen > 0) {
          console.log("rankedQueue",i,rankedQueueLen);
        }
      }
      console.log((await PriorityRegistry.getRedeemablesCap()).toNumber());
      console.log((await PriorityRegistry.getSweepablesCap()).toNumber());
    });
  });

  describe("setLICR authorization check",function() {
    it(`should success by governor`, async function () {
      const currentLICR = await PriorityRegistry.LICR();
      const newLICR = currentLICR.add(1);
      await PriorityRegistry.connect(accounts[0]).setLICR(newLICR);
      expect(await PriorityRegistry.LICR()).eq(newLICR);
    });

    it(`should fail by not governor`, async function () {
      const currentLICR = await PriorityRegistry.LICR();
      const newLICR = currentLICR.add(1);
      await PriorityRegistry.setLICR(newLICR);
      await expect(PriorityRegistry.connect(accounts[1]).setLICR(newLICR)).to.be.reverted;
    });
  });

  describe("mainnet properties", function() {
    before(async () => {
      await reset("https://eth-mainnet.g.alchemy.com/v2/LSQunA2PMIGyHH_8iyVqtDwLsZ9qzbr3");
    });
    it("watch priorities",async function() {
      PriorityRegistry = await ethers.getContractAt("PriorityRegistryV7","0x0c9Bdf09de9EaCbE692dB2c17a75bfdB5FF4190B");
      console.log("LICR",(await PriorityRegistry.LICR()).toNumber());
      for(var i=100;i<=130;i++) {
        const queueLen = await PriorityRegistry.rankedQueueTotalLen(i);
        if(queueLen.gt(0)) {
          console.log(i,queueLen.toNumber());
        }
      }
    });

    it("LICR change simulate",async function() {
      const PriorityRegistryAddr = "0x0c9Bdf09de9EaCbE692dB2c17a75bfdB5FF4190B";
      PriorityRegistry = await ethers.getContractAt("PriorityRegistryV7",PriorityRegistryAddr);

      console.log("LICR",(await PriorityRegistry.LICR()).toNumber());
      
      const currentRedeemablescap = await PriorityRegistry.getRedeemablesCap();
      console.log("redeemablescap",currentRedeemablescap.toNumber());

      let newLICR;
      for(var i=100;i<=130;i++) {
        const queueLen = await PriorityRegistry.rankedQueueTotalLen(i);
        if(queueLen.gt(0)) {
          newLICR = i;
          console.log("newLICR",newLICR);
          break;
        }
      }

      await setStorageAt(PriorityRegistryAddr, 108, "0x" + BigInt(newLICR).toString(16).padStart(64, "0"));
      console.log("LICR",(await PriorityRegistry.LICR()).toNumber());
      console.log("redeemablescap",(await PriorityRegistry.getRedeemablesCap()).toNumber());

    });
  });
});
