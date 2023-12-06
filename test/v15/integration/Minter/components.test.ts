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

const NUMBER_OF_ATTEMPTS = 20;
const SCALE = Constants.ten_to_the_20;
const week = Constants.week;
const month = Constants.month;

describe("YmtMinter components", function () {
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


    // await scoreWeightController.addType(
    //   "Currency",
    //   ethers.utils.parseEther("1")
    // );
    await scoreWeightController.addCurrency(
      scoreRegistry.address,
      ethers.utils.parseEther("10")
    );
    for (let i = 0; i < 4; i++) {
      await yamato
        .connect(accounts[i])
        .deposit({ value: ethers.utils.parseEther("100") });
    }
  });

  beforeEach(async () => {
    snapshot = await takeSnapshot();
  });

  afterEach(async () => {
    await snapshot.restore();
  });

  function generateUniqueRandomNumbers(
    count: number,
    min: number,
    max: number
  ): number[] {
    const set = new Set<number>();
    while (set.size < count) {
      const randomValue = Math.floor(Math.random() * (max - min + 1)) + min;
      set.add(randomValue);
    }
    return Array.from(set);
  }

  function approx(value: BigNumber, target: BigNumber, tol: BigNumber) {
    if (value.isZero() && target.isZero()) {
      return true;
    }

    const diff = value.sub(target).abs();
    const sum = value.add(target);
    const ratio = diff.mul(2).mul(BigNumber.from(SCALE)).div(sum);

    // console.log(
    //   `Value: ${value.toString()}, Target: ${target.toString()}, Tol: ${tol.toString()}`
    // );
    // console.log(
    //   `Diff: ${diff.toString()}, Sum: ${sum.toString()}, Ratio: ${ratio.toString()}`
    // );

    return ratio.lte(tol);
  }

  for (let i = 0; i < NUMBER_OF_ATTEMPTS; i++) {
    it(`tests duration ${i}`, async function () {
      const stDuration = generateUniqueRandomNumbers(3, week, month);
      const depositTime: number[] = [];

      await time.increase(week);

      for (let i = 0; i < 3; i++) {
        await yamato
          .connect(accounts[i + 1])
          .borrow(ethers.utils.parseEther("1"));
        depositTime.push(await time.latest());

        //   await showGaugeInfo();
      }
      const durations: number[] = [];
      const balances: BigNumber[] = [];
      for (let i = 0; i < 3; i++) {
        await time.increase(stDuration[i]);
        await yamato
          .connect(accounts[i + 1])
          .repay(ethers.utils.parseEther("0.999"));
        const duration = (await time.latest()) - depositTime[i];
        durations.push(duration);
        await ymtMinter.connect(accounts[i + 1]).mint(scoreRegistry.address);
        const balance = await YMT.balanceOf(accounts[i + 1].address);
        balances.push(balance);

        //   await showGaugeInfo();
      }

      const totalMinted: BigNumber = balances.reduce(
        (a: BigNumber, b: BigNumber) => a.add(b),
        ethers.BigNumber.from(0)
      );
      const weight1 = Math.floor(durations[0]);
      const weight2 = Math.floor(weight1 + (durations[1] - durations[0]) * 1.5);
      const weight3 = Math.floor(weight2 + (durations[2] - durations[1]) * 3);
      const totalWeight = weight1 + weight2 + weight3;

      console.log(
        `Total minted: ${totalMinted.toString()}, Total Weight: ${totalWeight.toString()}`
      );
      console.log(
        `Balance 1: ${balances[0]} (${balances[0]
          .mul(SCALE)
          .div(totalMinted)}) Weight 1: ${weight1.toString()} (${
          (100 * weight1) / totalWeight
        }%)`
      );
      console.log(
        `Balance 2: ${balances[1]} (${balances[1]
          .mul(SCALE)
          .div(totalMinted)}) Weight 2: ${weight2.toString()} (${
          (100 * weight2) / totalWeight
        }%)`
      );
      console.log(
        `Balance 3: ${balances[2]} (${balances[2]
          .mul(SCALE)
          .div(totalMinted)}) Weight 3: ${weight3.toString()} (${
          (100 * weight3) / totalWeight
        }%)`
      );

      expect(
        approx(
          balances[0].mul(SCALE).div(totalMinted),
          BigNumber.from(weight1).mul(SCALE).div(totalWeight),
          BigNumber.from(10).pow(18) // = (10 ** -4) * SCALE
        )
      ).to.be.true;
      expect(
        approx(
          balances[1].mul(SCALE).div(totalMinted),
          BigNumber.from(weight2).mul(SCALE).div(totalWeight),
          BigNumber.from(10).pow(18) // = (10 ** -4) * SCALE
        )
      ).to.be.true;
      expect(
        approx(
          balances[2].mul(SCALE).div(totalMinted),
          BigNumber.from(weight3).mul(SCALE).div(totalWeight),
          BigNumber.from(10).pow(18) // = (10 ** -4) * SCALE
        )
      ).to.be.true;
    });
  }

  for (let i = 0; i < NUMBER_OF_ATTEMPTS; i++) {
    it(`tests amounts ${i}`, async function () {
      const stAmounts = generateUniqueRandomNumbers(3, 1e17, 1e18);
      const depositTime: number[] = [];

      for (let i = 0; i < 3; i++) {
        await yamato.connect(accounts[i + 1]).borrow(stAmounts[i].toString());
        depositTime.push(await time.latest());
      }

      await time.increase(month);

      const balances: BigNumber[] = [];
      for (let i = 0; i < 3; i++) {
        yamato.connect(accounts[i + 1]).repay(stAmounts[i].toString());
      }

      for (let i = 0; i < 3; i++) {
        await ymtMinter.connect(accounts[i + 1]).mint(scoreRegistry.address);
        balances.push(await YMT.balanceOf(accounts[i + 1].address));
      }
      const totalDeposited: number = stAmounts.reduce(
        (a: number, b: number) => a + b,
        0
      );
      const totalMinted: BigNumber = balances.reduce(
        (a: BigNumber, b: BigNumber) => a.add(b),
        ethers.BigNumber.from(0)
      );

      console.log(
        `Total deposited: ${totalDeposited.toString()}, Total minted: ${totalMinted.toString()}`
      );
      console.log(
        `Balance 1: ${balances[0]} (${balances[0]
          .mul(SCALE)
          .div(totalMinted)}) Deposited 1: ${stAmounts[0].toString()} (${
          (100 * stAmounts[0]) / totalDeposited
        }%)`
      );
      console.log(
        `Balance 2: ${balances[1]} (${balances[1]
          .mul(SCALE)
          .div(totalMinted)}) Deposited 2: ${stAmounts[1].toString()} (${
          (100 * stAmounts[1]) / totalDeposited
        }%)`
      );
      console.log(
        `Balance 3: ${balances[2]} (${balances[2]
          .mul(SCALE)
          .div(totalMinted)}) Deposited 3: ${stAmounts[2].toString()} (${
          (100 * stAmounts[2]) / totalDeposited
        }%)`
      );

      expect(
        approx(
          balances[0].mul(SCALE).div(totalMinted),
          BigNumber.from(stAmounts[0].toString())
            .mul(SCALE)
            .div(totalDeposited.toString()),
          BigNumber.from(10).pow(18) // = (10 ** -4) * SCALE
        )
      ).to.be.true;
      expect(
        approx(
          balances[1].mul(SCALE).div(totalMinted),
          BigNumber.from(stAmounts[1].toString())
            .mul(SCALE)
            .div(totalDeposited.toString()),
          BigNumber.from(10).pow(18) // = (10 ** -4) * SCALE
        )
      ).to.be.true;
      expect(
        approx(
          balances[2].mul(SCALE).div(totalMinted),
          BigNumber.from(stAmounts[2].toString())
            .mul(SCALE)
            .div(totalDeposited.toString()),
          BigNumber.from(10).pow(18) // = (10 ** -4) * SCALE
        )
      ).to.be.true;
    });
  }
});
