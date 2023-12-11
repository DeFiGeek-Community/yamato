import { expect } from "chai";
import { ethers } from "hardhat";
import { BigNumber, Contract } from "ethers";
import {
  time,
  takeSnapshot,
  SnapshotRestorer,
} from "@nomicfoundation/hardhat-network-helpers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import {
  FeePool,
  YmtVesting,
  YMT,
  VeYMT,
  FeePool__factory,
  YmtVesting__factory,
  YMT__factory,
  VeYMT__factory,
} from "../../../../typechain";
import { getProxy } from "../../../../src/testUtil";
import { contractVersion } from "../../../param/version";
import Constants from "../../Constants";
import {
  randomValue,
  getRandomAccountNum,
  getRandomWeeks,
  getRandomAmounts,
  getRandomsTime,
} from "../../testHelpers";

// 参考) brownie Stateful Tests
// https://eth-brownie.readthedocs.io/en/stable/tests-hypothesis-stateful.html

const ACCOUNT_NUM = 5;
const MAX_EXAMPLES = 50;
const STATEFUL_STEP_COUNT = 30;
const week = Constants.week;
const year = Constants.year;
const MAX_UINT256 = Constants.MAX_UINT256;

// ------------------------------------------------

describe("FeePoolV2", function () {
  let accounts: SignerWithAddress[];
  let veYMT: Contract;
  let feePool: Contract;
  let YMT: Contract;
  let YmtVesting: YmtVesting;

  let lockedUntil: { [key: string]: number } = {};
  let fees: { [key: number]: BigNumber } = {}; // timestamp -> amount
  let userClaims: { [key: string]: { [key: number]: BigNumber[] } } = {}; // address -> timestamp -> [claimed, timeCursor]
  let totalFees: BigNumber;

  let snapshot: SnapshotRestorer;

  before(async () => {
    accounts = (await ethers.getSigners()).slice(0, ACCOUNT_NUM);

    lockedUntil = {};
    fees = {};
    userClaims = {};
    totalFees = ethers.utils.parseEther("1");

    YmtVesting = await (<YmtVesting__factory>(
      await ethers.getContractFactory("YmtVesting")
    )).deploy();

    YMT = await (<YMT__factory>await ethers.getContractFactory("YMT")).deploy(YmtVesting.address);

    veYMT = await (<VeYMT__factory>(
      await ethers.getContractFactory("veYMT")
    )).deploy(YMT.address);

    for (let i = 0; i < ACCOUNT_NUM; i++) {
      // ensure accounts[:5] all have YMTs that may be locked
      await YMT.connect(accounts[0]).transfer(
        accounts[i].address,
        ethers.utils.parseEther("10000000")
      );
      await YMT.connect(accounts[i]).approve(veYMT.address, MAX_UINT256);

      userClaims[accounts[i].address] = [];
    }

    // accounts[0] locks 10,000,000 tokens for 2 years - longer than the maximum duration of the test
    await veYMT
      .connect(accounts[0])
      .createLock(
        ethers.utils.parseEther("10000000"),
        (await time.latest()) + year * 2
      );

    // a week later we deploy the fee feePool
    await time.increase(week);

    feePool = await getProxy<FeePool, FeePool__factory>(
      contractVersion["FeePool"],
      [await time.latest()]
    );
    await feePool.setVeYMT(veYMT.address);
  });

  beforeEach(async () => {
    snapshot = await takeSnapshot();

    lockedUntil = {
      [accounts[0].address]: (
        await veYMT.lockedEnd(accounts[0].address)
      ).toNumber(),
    };
  });

  afterEach(async () => {
    await snapshot.restore();
  });

  //--------------------------------------------- functions -----------------------------------------------------------//
  async function _checkActiveLock(stAcct: SignerWithAddress) {
    // check if `st_acct` has an active lock
    if (!lockedUntil[stAcct.address]) {
      return false;
    }

    const currentTime = await time.latest();

    if (lockedUntil[stAcct.address] < currentTime) {
      await veYMT.connect(stAcct).withdraw();
      delete lockedUntil[stAcct.address];
      return false;
    }

    return true;
  }
  //--------------------------------------------- randomly excuted functions -----------------------------------------------------------//
  async function ruleNewLock(
    stAcct?: SignerWithAddress,
    stAmount?: BigNumber,
    stWeeks?: BigNumber,
    stTime?: BigNumber
  ) {
    /*
    Add a new user lock.

    Arguments
    ---------
    stAcct : SignerWithAddress
        Account to lock tokens for. If this account already has an active
        lock, the rule is skipped.
    stAmount: BigNumber
        Amount of tokens to lock.
    stWeeks: BigNumber
        Duration of lock, given in weeks.
    stTime: BigNumber
        Duration to sleep before action, in seconds.
    */
    stAcct = stAcct || accounts[getRandomAccountNum()];
    stAmount = stAmount || getRandomAmounts();
    stWeeks = stWeeks || getRandomWeeks();
    stTime = stTime || getRandomsTime();

    console.log(`
    ruleNewLock --- 
    stAcct: ${
      stAcct.address
    }, stAmount: ${stAmount.toString()}, stWeeks: ${stWeeks.toString()}, stTime: ${stTime.toString()}
    `);

    stTime.gt(0) && (await time.increase(stTime));

    if (!(await _checkActiveLock(stAcct))) {
      const until =
        (Math.floor((await time.latest()) / week) + stWeeks.toNumber()) * week;
      await veYMT.connect(stAcct).createLock(stAmount, until);
      lockedUntil[stAcct.address] = until;
    }
  }

  async function ruleExtendLock(
    stAcct?: SignerWithAddress,
    stWeeks?: BigNumber,
    stTime?: BigNumber
  ) {
    /*
    Extend an existing user lock.

    Arguments
    ---------
    stAcct: SignerWithAddress
        Account to extend lock for. If this account does not have an active
        lock, the rule is skipped.
    stWeeks: BigNumber
        Duration to extend the lock, given in weeks.
    stTime: BigNumber
        Duration to sleep before action, in seconds.
    */
    stAcct = stAcct || accounts[getRandomAccountNum()];
    stWeeks = stWeeks || getRandomWeeks();
    stTime = stTime || getRandomsTime();

    console.log(`
    ruleExtendLock --- stAmount ${
      stAcct.address
    }, stAmount: ${stWeeks.toString()}, stTime: ${stTime.toString()}
    `);

    stTime.gt(0) && (await time.increase(stTime));

    if (await _checkActiveLock(stAcct)) {
      const until =
        (Math.floor((await veYMT.lockedEnd(stAcct.address)).toNumber() / week) +
          stWeeks.toNumber()) *
        week;
      const newUntil = Math.min(
        until,
        Math.floor(((await time.latest()) + year * 4) / week) * week
      );
      await veYMT.connect(stAcct).increaseUnlockTime(newUntil);
      lockedUntil[stAcct.address] = newUntil;
    }
  }

  async function ruleIncreaseLockAmount(
    stAcct?: SignerWithAddress,
    stAmount?: BigNumber,
    stTime?: BigNumber
  ) {
    console.log("ruleIncreaseLockAmount");

    /*
    Increase the amount of an existing user lock.

    Arguments
    ---------
    stAcct : SignerWithAddress
        Account to increase lock amount for. If this account does not have an
        active lock, the rule is skipped.
    stAmount : BigNumber
        Amount of tokens to add to lock.
    stTime : number
        Duration to sleep before action, in seconds.
    */
    stAcct = accounts[getRandomAccountNum()];
    stAmount = getRandomAmounts();
    stTime = getRandomsTime();

    console.log(`
    ruleIncreaseLockAmount --- stAmount ${
      stAcct.address
    }, stAmount: ${stAmount.toString()}, stTime: ${stTime.toString()}
    `);

    stTime.gt(0) && (await time.increase(stTime));

    if (await _checkActiveLock(stAcct)) {
      await veYMT.connect(stAcct).increaseAmount(stAmount);
    }
  }

  async function ruleClaimFees(stAcct?: SignerWithAddress, stTime?: BigNumber) {
    console.log("ruleClaimFees");
    /*
    Claim fees for a user.

    Arguments
    ---------
    stAcct : SignerWithAddress
        Account to claim fees for.
    stTime : number
        Duration to sleep before action, in seconds.
    */
    stAcct = accounts[getRandomAccountNum()];
    stTime = getRandomsTime();

    console.log(`
    ruleClaimFees --- stAmount ${stAcct.address}, stTime: ${stTime.toString()}
    `);

    stTime.gt(0) && (await time.increase(stTime));

    // For debug ---
    // const t0: number = (await feePool.startTime()).toNumber();
    // const ue = await feePool.userEpochOf(stAcct.address);
    // const up = await veYMT.userPointHistory(stAcct.address, ue);
    // console.log(`Week:
    //     ${Math.floor(((await time.latest()) - t0) / week)}

    //     Point: ${up}
    //     `);
    // ---

    const claimed = await ethers.provider.getBalance(stAcct.address);
    const tx = await feePool.connect(stAcct)["claim()"]();
    const newClaimed = (await ethers.provider.getBalance(stAcct.address)).sub(
      claimed
    );
    userClaims[stAcct.address][tx.blockNumber] = [
      newClaimed,
      await feePool.timeCursorOf(stAcct.address),
    ];
  }

  async function ruleTransferFees(stAmount?: BigNumber, stTime?: BigNumber) {
    console.log("ruleTransferFees");
    /*
    Transfer fees into the feePool and make a checkpoint.

    If this is the first checkpoint, `can_checkpoint_token` is also
    enabled.

    Arguments
    ---------
    stAmount : BigNumber
        Amount of fee tokens to add to the feePool.
    stTime : number
        Duration to sleep before action, in seconds.
    */
    stAmount = stAmount || getRandomAmounts();
    stTime = stTime || getRandomsTime();

    console.log(`
    ruleTransferFees --- stAmount ${stAmount.toString()}, stTime: ${stTime.toString()}
    `);

    stTime.gt(0) && (await time.increase(stTime));

    const tx = await accounts[0].sendTransaction({
      to: feePool.address,
      value: stAmount,
    });
    // const tx = await feeCoin._mintForTesting(feePool.address, stAmount);

    if (!(await feePool.canCheckpointToken())) {
      await feePool.toggleAllowCheckpointToken();
      await feePool.checkpointToken();
    }

    fees[tx.blockNumber] = stAmount;
    totalFees = totalFees.add(stAmount);
  }

  async function ruleTransferFeesWithoutCheckpoint(
    stAmount?: BigNumber,
    stTime?: BigNumber
  ) {
    console.log("ruleTransferFeesWithoutCheckpoint");

    /*
    Transfer fees into the feePool without checkpointing.

    Arguments
    ---------
    stAmount : BigNumber
        Amount of fee tokens to add to the feePool.
    stTime : number
        Duration to sleep before action, in seconds.
    */
    stAmount = stAmount || getRandomAmounts();
    stTime = stTime || getRandomsTime();

    console.log(`
    ruleTransferFeesWithoutCheckpoint --- stAmount ${stAmount.toString()}, stTime: ${stTime.toString()}
    `);

    stTime.gt(0) && (await time.increase(stTime));

    const tx = await accounts[0].sendTransaction({
      to: feePool.address,
      value: stAmount,
    });
    // const tx = await feeCoin._mintForTesting(feePool.address, stAmount);

    fees[tx.blockNumber] = stAmount;
    totalFees = totalFees.add(stAmount);
  }

  async function teardown() {
    /*
    Claim fees for all accounts and verify that only dust remains.
    */
    console.log("teardown----");
    if (!(await feePool.canCheckpointToken())) {
      //if no token checkpoint occured, add 100,000 tokens prior to teardown
      await ruleTransferFees(
        ethers.utils.parseEther("100000"),
        BigNumber.from("0")
      );
    }

    // Need two checkpoints to get tokens fully distributed
    // Because tokens for current week are obtained in the next week
    // And that is by design
    await feePool.checkpointToken();
    await time.increase(week * 2);
    await feePool.checkpointToken();
    const balanceList = [];
    for (const acct of accounts) {
      // For debug --->
      //   const t0: number = (await feePool.startTime()).toNumber();
      //   const ue = await feePool.userEpochOf(acct.address);
      //   const up = await veYMT.userPointHistory(acct.address, ue);
      //   console.log(`Week:
      //     ${Math.floor(((await time.latest()) - t0) / week)}

      //     Point: ${up}
      //     `);
      // <----
      balanceList[acct.address] = await ethers.provider.getBalance(
        acct.address
      );
      const claimTx = await feePool.connect(acct)["claim()"]();
      const receipt = await claimTx.wait();
      const gasCost = receipt.gasUsed.mul(receipt.effectiveGasPrice);
      balanceList[acct.address] = balanceList[acct.address].sub(gasCost);
    }

    const t0: number = (await feePool.startTime()).toNumber();
    const t1: number = Math.floor((await time.latest()) / week) * week;

    const tokensPerUserPerWeek = [];
    for (const acct of accounts) {
      tokensPerUserPerWeek[acct.address] = [];
      for (let w = t0; w < t1 + week; w += week) {
        const tokens = (await feePool.tokensPerWeek(w))
          .mul(await feePool.veForAt(acct.address, w))
          .div(await feePool.veSupply(w));
        tokensPerUserPerWeek[acct.address].push(tokens);
      }
    }

    // Display results--------------------------------------------------
    // console.log(`Results: ${tokensPerUserPerWeek}`);
    // console.log(`TokensPerUserPerWeek------------`);
    // Object.entries(tokensPerUserPerWeek).forEach(([key, val]) => {
    //   console.log(`${key}: ${val}`);
    // });
    // console.log(``);
    // console.log(`Fees-----------`);
    // Object.entries(fees).forEach(([key, val]) => {
    //   console.log(`${key}: ${val}`);
    // });
    // console.log(``);
    // console.log(`Total Fee-----------`);
    // console.log(totalFees.toString());
    // console.log(``);
    // console.log(`User claims---------`);
    // Object.entries(userClaims).forEach(([key, val]) => {
    //   console.log(`${key}:`);
    //   Object.entries(val).forEach(([k, v]) => {
    //     console.log(`${k}: ${v}`);
    //   });
    // });
    // console.log(``);
    // console.log(`User balances---------`);
    // for (const acct of accounts) {
    //   console.log(
    //     acct.address,
    //     (await feeCoin.balanceOf(acct.address)).toString()
    //   );
    // }
    // console.log(`feeCoin balance of Distributor--------`);
    // console.log((await feeCoin.balanceOf(feePool.address)).toString());
    // -------------------------------------------

    for (const acct of accounts) {
      expect(
        (await ethers.provider.getBalance(acct.address)).sub(
          BigNumber.from(balanceList[acct.address])
        )
      ).to.equal(
        tokensPerUserPerWeek[acct.address].reduce(
          (a: BigNumber, b: BigNumber) => a.add(b),
          BigNumber.from("0")
        )
      );
    }

    // Check if all fees are distributed
    expect(await ethers.provider.getBalance(feePool.address)).to.be.lt(100);
  }

  let func = [
    "ruleNewLock",
    "ruleExtendLock",
    "ruleIncreaseLockAmount",
    "ruleTransferFees",
    "ruleTransferFeesWithoutCheckpoint",
  ];

  describe("test_deposit_withdraw_voting", function () {
    // 複数のアカウントに対して預金と引き出しのテストを実行し、FeeのETHが正しく分配されることを確認
    for (let i = 0; i < MAX_EXAMPLES; i++) {
      it(`should distribute fee correctly in example ${i}`, async () => {
        // Corresponds initializer initialize_new_lock and initialize_transfer_fees
        // https://eth-brownie.readthedocs.io/en/stable/tests-hypothesis-stateful.html#initializers
        // initialize_new_lock: This is equivalent to `rule_new_lock` to make it more likely we have at least 2 accounts locked at the start of the test run.
        // initialize_transfer_fees: This is equivalent to `rule_transfer_fees` to make it more likely that claimable fees are available from the start of the test.
        const initializerSeed = Math.random();
        if (initializerSeed < 0.2) {
          console.log("0.2");
          await ruleNewLock();
          await ruleTransferFees();
        } else if (initializerSeed < 0.4) {
          console.log("0.4");
          await ruleTransferFees();
          await ruleNewLock();
        } else if (initializerSeed < 0.6) {
          console.log("0.6");
          await ruleNewLock();
        } else if (initializerSeed < 0.8) {
          console.log("0.8");
          await ruleTransferFees();
        }

        const steps = randomValue(1, STATEFUL_STEP_COUNT);
        for (let x = 0; x < steps; x++) {
          let n = randomValue(0, func.length);
          await eval(func[n])();
        }

        await teardown();
      });
    }
  });
});
