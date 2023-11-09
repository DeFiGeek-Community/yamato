import { expect } from "chai";
import { ethers } from "hardhat";
import { BigNumber, Contract } from "ethers";
import {
  time,
  takeSnapshot,
  SnapshotRestorer,
} from "@nomicfoundation/hardhat-network-helpers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";

// 参考) brownie Stateful Tests
// https://eth-brownie.readthedocs.io/en/stable/tests-hypothesis-stateful.html

const ACCOUNT_NUM = 5;
const MAX_EXAMPLES = 50;
const STATEFUL_STEP_COUNT = 30;
const WEEK = 86400 * 7;
const YEAR = 86400 * 365;
const two_to_the_256_minus_1 = BigNumber.from("2")
  .pow(BigNumber.from("256"))
  .sub(BigNumber.from("1"));
const MOUNT_DECIMALS = 3;

// Helper functions to generate random variables ----->
function randomBigValue(min: number, max: number): BigNumber {
  return BigNumber.from(
    Math.floor(Math.random() * (max - min) + min).toString()
  );
}
function randomValue(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min) + min);
}
function getRandomAccountNum(): number {
  // Corresponds strategy("address", length=5)
  let rdm = Math.floor(Math.random() * ACCOUNT_NUM); //0~9 integer
  return rdm;
}
function getRandomWeeks(): BigNumber {
  // Corresponds strategy("uint256", min_value=1, max_value=12)
  return randomBigValue(1, 12);
}
function getRandomAmounts(): BigNumber {
  // Corresponds strategy("decimal", min_value=1, max_value=100, places=3)
  return randomBigValue(
    1 * 10 ** MOUNT_DECIMALS,
    100 * 10 ** MOUNT_DECIMALS
  ).mul(BigNumber.from(10).pow(18 - MOUNT_DECIMALS));
}
function getRandomsTime(): BigNumber {
  // Corresponds strategy("uint256", min_value=0, max_value=86400 * 3)
  return randomBigValue(0, 86400 * 3);
}
// ------------------------------------------------

describe("FeeDistributor", function () {
  let accounts: SignerWithAddress[];
  let votingEscrow: Contract;
  let distributor: Contract;
  let feeCoin: Contract;
  let token: Contract;

  let lockedUntil: { [key: string]: number } = {};
  let fees: { [key: number]: BigNumber } = {}; // timestamp -> amount
  let userClaims: { [key: string]: { [key: number]: BigNumber[] } } = {}; // address -> timestamp -> [claimed, timeCursor]
  let totalFees: BigNumber = ethers.utils.parseEther("1");

  let snapshot: SnapshotRestorer;

  beforeEach(async () => {
    snapshot = await takeSnapshot();
    accounts = (await ethers.getSigners()).slice(0, ACCOUNT_NUM);

    lockedUntil = {};
    fees = {};
    userClaims = {};
    totalFees = ethers.utils.parseEther("1");

    const CRV = await ethers.getContractFactory("CRV");
    const Token = await ethers.getContractFactory("MockToken");
    const VotingEscrow = await ethers.getContractFactory("VotingEscrow");
    const FeeDistributor = await ethers.getContractFactory("FeeDistributor");

    token = await CRV.deploy();
    await token.deployed();

    feeCoin = await Token.deploy("Test Token", "TST", 18);
    await feeCoin.deployed();

    votingEscrow = await VotingEscrow.deploy(
      token.address,
      "Voting-escrowed token",
      "vetoken",
      "v1"
    );
    await votingEscrow.deployed();

    for (let i = 0; i < ACCOUNT_NUM; i++) {
      // ensure accounts[:5] all have tokens that may be locked
      await token
        .connect(accounts[0])
        .transfer(accounts[i].address, ethers.utils.parseEther("10000000"));
      await token
        .connect(accounts[i])
        .approve(votingEscrow.address, two_to_the_256_minus_1);

      userClaims[accounts[i].address] = [];
    }

    // accounts[0] locks 10,000,000 tokens for 2 years - longer than the maximum duration of the test
    await votingEscrow
      .connect(accounts[0])
      .createLock(
        ethers.utils.parseEther("10000000"),
        (await time.latest()) + YEAR * 2
      );

    lockedUntil = {
      [accounts[0].address]: (
        await votingEscrow.lockedEnd(accounts[0].address)
      ).toNumber(),
    };

    // a week later we deploy the fee distributor
    // await ethers.provider.send("evm_increaseTime", [WEEK]);
    await time.increase(WEEK);

    distributor = await FeeDistributor.deploy(
      votingEscrow.address,
      await time.latest(),
      feeCoin.address,
      accounts[0].address,
      accounts[0].address
    );
    await distributor.deployed();
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
      await votingEscrow.connect(stAcct).withdraw();
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
        (Math.floor((await time.latest()) / WEEK) + stWeeks.toNumber()) * WEEK;
      await votingEscrow.connect(stAcct).createLock(stAmount, until);
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
        (Math.floor(
          (await votingEscrow.lockedEnd(stAcct.address)).toNumber() / WEEK
        ) +
          stWeeks.toNumber()) *
        WEEK;
      const newUntil = Math.min(
        until,
        Math.floor(((await time.latest()) + YEAR * 4) / WEEK) * WEEK
      );
      await votingEscrow.connect(stAcct).increaseUnlockTime(newUntil);
      lockedUntil[stAcct.address] = newUntil;
    }
  }

  async function ruleIncreaseLockAmount(
    stAcct?: SignerWithAddress,
    stAmount?: BigNumber,
    stTime?: BigNumber
  ) {
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
      await votingEscrow.connect(stAcct).increaseAmount(stAmount);
    }
  }

  async function ruleClaimFees(stAcct?: SignerWithAddress, stTime?: BigNumber) {
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
    // const t0: number = (await distributor.startTime()).toNumber();
    // const ue = await distributor.userEpochOf(stAcct.address);
    // const up = await votingEscrow.userPointHistory(stAcct.address, ue);
    // console.log(`Week:
    //     ${Math.floor(((await time.latest()) - t0) / WEEK)}

    //     Point: ${up}
    //     `);
    // ---

    const claimed = await feeCoin.balanceOf(stAcct.address);
    const tx = await distributor.connect(stAcct)["claim()"]();
    const newClaimed = (await feeCoin.balanceOf(stAcct.address)).sub(claimed);
    userClaims[stAcct.address][tx.blockNumber] = [
      newClaimed,
      await distributor.timeCursorOf(stAcct.address),
    ];
  }

  async function ruleTransferFees(stAmount?: BigNumber, stTime?: BigNumber) {
    /*
    Transfer fees into the distributor and make a checkpoint.

    If this is the first checkpoint, `can_checkpoint_token` is also
    enabled.

    Arguments
    ---------
    stAmount : BigNumber
        Amount of fee tokens to add to the distributor.
    stTime : number
        Duration to sleep before action, in seconds.
    */
    stAmount = stAmount || getRandomAmounts();
    stTime = stTime || getRandomsTime();

    console.log(`
    ruleTransferFees --- stAmount ${stAmount.toString()}, stTime: ${stTime.toString()}
    `);

    stTime.gt(0) && (await time.increase(stTime));

    const tx = await feeCoin._mintForTesting(distributor.address, stAmount);

    if (!(await distributor.canCheckpointToken())) {
      await distributor.toggleAllowCheckpointToken();
      await distributor.checkpointToken();
    }

    fees[tx.blockNumber] = stAmount;
    totalFees = totalFees.add(stAmount);
  }

  async function ruleTransferFeesWithoutCheckpoint(
    stAmount?: BigNumber,
    stTime?: BigNumber
  ) {
    /*
    Transfer fees into the distributor without checkpointing.

    Arguments
    ---------
    stAmount : BigNumber
        Amount of fee tokens to add to the distributor.
    stTime : number
        Duration to sleep before action, in seconds.
    */
    stAmount = stAmount || getRandomAmounts();
    stTime = stTime || getRandomsTime();

    console.log(`
    ruleTransferFeesWithoutCheckpoint --- stAmount ${stAmount.toString()}, stTime: ${stTime.toString()}
    `);

    stTime.gt(0) && (await time.increase(stTime));

    const tx = await feeCoin._mintForTesting(distributor.address, stAmount);

    fees[tx.blockNumber] = stAmount;
    totalFees = totalFees.add(stAmount);
  }

  async function teardown() {
    /*
    Claim fees for all accounts and verify that only dust remains.
    */
    console.log("teardown----");
    if (!(await distributor.canCheckpointToken())) {
      //if no token checkpoint occured, add 100,000 tokens prior to teardown
      await ruleTransferFees(
        ethers.utils.parseEther("100000"),
        BigNumber.from("0")
      );
    }

    // Need two checkpoints to get tokens fully distributed
    // Because tokens for current week are obtained in the next week
    // And that is by design
    await distributor.checkpointToken();
    await ethers.provider.send("evm_increaseTime", [WEEK * 2]);
    await distributor.checkpointToken();

    for (const acct of accounts) {
      // For debug --->
      //   const t0: number = (await distributor.startTime()).toNumber();
      //   const ue = await distributor.userEpochOf(acct.address);
      //   const up = await votingEscrow.userPointHistory(acct.address, ue);
      //   console.log(`Week:
      //     ${Math.floor(((await time.latest()) - t0) / WEEK)}

      //     Point: ${up}
      //     `);
      // <----

      await distributor.connect(acct)["claim()"]();
    }

    const t0: number = (await distributor.startTime()).toNumber();
    const t1: number = Math.floor((await time.latest()) / WEEK) * WEEK;

    const tokensPerUserPerWeek = [];
    for (const acct of accounts) {
      tokensPerUserPerWeek[acct.address] = [];
      for (let w = t0; w < t1 + WEEK; w += WEEK) {
        const tokens = (await distributor.tokensPerWeek(w))
          .mul(await distributor.veForAt(acct.address, w))
          .div(await distributor.veSupply(w));
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
    // console.log((await feeCoin.balanceOf(distributor.address)).toString());
    // -------------------------------------------

    for (const acct of accounts) {
      expect(await feeCoin.balanceOf(acct.address)).to.equal(
        tokensPerUserPerWeek[acct.address].reduce(
          (a: BigNumber, b: BigNumber) => a.add(b),
          BigNumber.from("0")
        )
      );
    }

    // Check if all fees are distributed
    expect(await feeCoin.balanceOf(distributor.address)).to.be.lt(100);
  }

  let func = [
    "ruleNewLock",
    "ruleExtendLock",
    "ruleIncreaseLockAmount",
    "ruleClaimFees",
    "ruleTransferFees",
    "ruleTransferFeesWithoutCheckpoint",
  ];

  describe("test_deposit_withdraw_voting", function () {
    for (let i = 0; i < MAX_EXAMPLES; i++) {
      it(`should distributes fee ${i}`, async () => {
        // Corresponds initializer initialize_new_lock and initialize_transfer_fees
        // https://eth-brownie.readthedocs.io/en/stable/tests-hypothesis-stateful.html#initializers
        // initialize_new_lock: This is equivalent to `rule_new_lock` to make it more likely we have at least 2 accounts locked at the start of the test run.
        // initialize_transfer_fees: This is equivalent to `rule_transfer_fees` to make it more likely that claimable fees are available from the start of the test.
        const initializerSeed = Math.random();
        if (initializerSeed < 0.2) {
          await ruleNewLock();
          await ruleTransferFees();
        } else if (initializerSeed < 0.4) {
          await ruleTransferFees();
          await ruleNewLock();
        } else if (initializerSeed < 0.6) {
          await ruleNewLock();
        } else if (initializerSeed < 0.8) {
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
