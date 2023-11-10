import { expect } from "chai";
import { ethers } from "hardhat";
import { BigNumber, Contract } from "ethers";
import {
  time,
  takeSnapshot,
  SnapshotRestorer,
} from "@nomicfoundation/hardhat-network-helpers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";

const ACCOUNT_NUM = 10;
const MAX_EXAMPLES = 30; // テストの試行回数
const STATEFUL_STEP_COUNT = 20; // ruleの実行回数
const YEAR = BigNumber.from(86400 * 365);
const WEEK = BigNumber.from(86400 * 7);
const two_to_the_256_minus_1 = BigNumber.from("2")
  .pow(BigNumber.from("256"))
  .sub(BigNumber.from("1"));
const ten_to_the_40 = BigNumber.from(
  "10000000000000000000000000000000000000000"
);

describe("VotingEscrow", function () {
  let accounts: SignerWithAddress[];
  let votingEscrow: Contract;
  let token: Contract;

  let stAccountN: number;
  let stAccount: SignerWithAddress;
  let stValue: BigNumber = BigNumber.from("0");
  let stLockDuration: BigNumber;
  let votingBalances: { [key: string]: BigNumber }[];
  let unlockTime: BigNumber;

  let snapshot: SnapshotRestorer;

  beforeEach(async () => {
    snapshot = await takeSnapshot();
    accounts = (await ethers.getSigners()).slice(0, ACCOUNT_NUM);

    const Token = await ethers.getContractFactory("MockToken");
    const VotingEscrow = await ethers.getContractFactory("VotingEscrow");

    token = await Token.deploy("Test Token", "TST", 18);
    await token.deployed();

    votingEscrow = await VotingEscrow.deploy(
      token.address,
      "Voting-escrowed token",
      "vetoken",
      "v1"
    );
    await votingEscrow.deployed();

    //init
    for (let i = 0; i < ACCOUNT_NUM; i++) {
      await token
        .connect(accounts[i])
        ._mintForTesting(accounts[i].address, ten_to_the_40);
      await token
        .connect(accounts[i])
        .approve(votingEscrow.address, two_to_the_256_minus_1);
    }

    //setup
    votingBalances = new Array(ACCOUNT_NUM).fill({
      value: BigNumber.from("0"),
      unlockTime: BigNumber.from("0"),
    });
  });

  //--------------------------------------------- functions -----------------------------------------------------------//

  function rdmValue(a): BigNumber {
    let rdm = BigNumber.from(Math.floor(Math.random() * a).toString());
    return rdm;
  }

  //--------------------------------------------- randomly excuted functions -----------------------------------------------------------//
  async function ruleCreateLock() {
    console.log("ruleCreateLock");

    //stAccount
    let rdm = Math.floor(Math.random() * 10); //0~9 integer
    stAccountN = rdm;
    stAccount = accounts[stAccountN];

    //stValue
    stValue = rdmValue(9007199254740991);

    //number of weeks to lock a deposit
    stLockDuration = rdmValue(255); //uint8.max

    let timestamp = BigNumber.from(await time.latest());
    unlockTime = timestamp.add(WEEK.mul(stLockDuration)).div(WEEK).mul(WEEK);

    if (stValue.eq(0)) {
      // console.log("--revert: 1");
      await expect(
        votingEscrow.connect(stAccount).createLock(stValue, unlockTime)
      ).to.revertedWith("need non-zero value");
    } else if (votingBalances[stAccountN]["value"].gt("0")) {
      // console.log("--revert: 2");
      await expect(
        votingEscrow.connect(stAccount).createLock(stValue, unlockTime)
      ).to.revertedWith("Withdraw old tokens first");
    } else if (unlockTime.lte(timestamp)) {
      // console.log("--revert: 3");
      await expect(
        votingEscrow.connect(stAccount).createLock(stValue, unlockTime)
      ).to.revertedWith("Can only lock until time in the future");
    } else if (unlockTime.gte(timestamp.add(YEAR.mul("4")))) {
      // console.log("--revert: 4");
      await expect(
        votingEscrow.connect(stAccount).createLock(stValue, unlockTime)
      ).to.revertedWith("Voting lock can be 4 years max");
    } else {
      // console.log("--success, account:", stAccountN);
      const tx = await votingEscrow
        .connect(stAccount)
        .createLock(stValue, unlockTime);
      const receipt = await tx.wait();
      votingBalances[stAccountN] = {
        value: stValue,
        unlockTime: receipt.events[1]["args"]["locktime"],
      };
    }
  }

  async function ruleIncreaseAmount() {
    console.log("ruleIncreaseAmount");

    //stAccount
    let rdm = Math.floor(Math.random() * 10); //0~9 integer
    stAccountN = rdm;
    stAccount = accounts[stAccountN];

    //stValue
    stValue = rdmValue(9007199254740991);

    let timestamp = BigNumber.from(await time.latest());

    if (stValue.eq(0)) {
      // console.log("--revert: 1");
      await expect(
        votingEscrow.connect(stAccount).increaseAmount(stValue)
      ).to.revertedWith("dev: need non-zero value");
    } else if (votingBalances[stAccountN]["value"].eq("0")) {
      // console.log("--revert: 2");
      await expect(
        votingEscrow.connect(stAccount).increaseAmount(stValue)
      ).to.revertedWith("No existing lock found");
    } else if (votingBalances[stAccountN]["unlockTime"].lte(timestamp)) {
      // console.log("--revert: 3");
      await expect(
        votingEscrow.connect(stAccount).increaseAmount(stValue)
      ).to.revertedWith("Cannot add to expired lock. Withdraw");
    } else {
      await votingEscrow.connect(stAccount).increaseAmount(stValue);
      votingBalances[stAccountN]["value"] =
        votingBalances[stAccountN]["value"].add(stValue);

      // console.log(
      //   "--success, account:",
      //   stAccountN,
      //   "new balance:",
      //   votingBalances[stAccountN]["value"].toString()
      // );
    }
  }

  async function ruleIncreaseUnlockTime() {
    console.log("ruleIncreaseUnlockTime");

    //stAccount
    let rdm = Math.floor(Math.random() * 10); //0~9 integer
    stAccountN = rdm;
    stAccount = accounts[stAccountN];

    //unlockTime
    let timestamp = BigNumber.from(await time.latest());
    stLockDuration = rdmValue(255); //number of weeks
    let unlockTime = timestamp
      .add(stLockDuration.mul(WEEK))
      .div(WEEK)
      .mul(WEEK);

    if (votingBalances[stAccountN]["unlockTime"].lte(timestamp)) {
      // console.log("--revert: 1");
      await expect(
        votingEscrow.connect(stAccount).increaseUnlockTime(unlockTime)
      ).to.revertedWith("Lock expired");
    } else if (votingBalances[stAccountN]["value"].eq("0")) {
      // console.log("--revert: 2");
      await expect(
        votingEscrow.connect(stAccount).increaseUnlockTime(unlockTime)
      ).to.revertedWith("Nothing is locked");
    } else if (votingBalances[stAccountN]["unlockTime"].gte(unlockTime)) {
      // console.log("--revert: 3");
      await expect(
        votingEscrow.connect(stAccount).increaseUnlockTime(unlockTime)
      ).to.revertedWith("Can only increase lock duration");
    } else if (unlockTime.gt(timestamp.add(YEAR.mul("4")))) {
      // console.log("--revert: 4");
      await expect(
        votingEscrow.connect(stAccount).increaseUnlockTime(unlockTime)
      ).to.revertedWith("Voting lock can be 4 years max");
    } else {
      // console.log("--success, account:", stAccountN);
      const tx = await votingEscrow
        .connect(stAccount)
        .increaseUnlockTime(unlockTime);
      const receipt = await tx.wait();
      votingBalances[stAccountN]["unlockTime"] =
        receipt.events[0]["args"]["locktime"];
    }
  }

  async function ruleWithdraw() {
    console.log("ruleWithdraw");
    // Withdraw tokens from the voting escrow.

    //stAccount
    let rdm = Math.floor(Math.random() * 10); //0~9 integer
    stAccountN = rdm;
    stAccount = accounts[stAccountN];

    let timestamp = BigNumber.from(await time.latest());

    if (votingBalances[stAccountN]["unlockTime"].gt(timestamp)) {
      // console.log("--reverted");
      await expect(votingEscrow.connect(stAccount).withdraw()).to.revertedWith(
        "The lock didn't expire"
      );
    } else {
      // console.log("--success, account:", stAccountN);
      await votingEscrow.connect(stAccount).withdraw();
      votingBalances[stAccountN]["value"] = BigNumber.from("0");
    }
  }

  async function ruleCheckpoint() {
    console.log("ruleCheckpoint");

    //stAccount
    let rdm = Math.floor(Math.random() * 10); //0~9 integer
    stAccountN = rdm;
    stAccount = accounts[stAccountN];

    await votingEscrow.connect(stAccount).checkpoint();
  }

  async function ruleAdvanceTime() {
    console.log("ruleAdvanceTime");

    let stSleepDuration = Math.floor(Math.random() * 3) + 1; //1~4

    await time.increase(WEEK.mul(stSleepDuration).toNumber());

    if (stSleepDuration == 1) {
      console.log("Time advanced");
    } else {
      console.log("Time advanced");
    }
  }

  async function checkInvariants() {
    // console.log("=====Invariant checks=====");

    // console.log("invariant_token_balances");
    for (let i = 0; i < ACCOUNT_NUM; i++) {
      expect(await token.balanceOf(accounts[i].address)).to.equal(
        ten_to_the_40.sub(votingBalances[i]["value"])
      );
    }

    // console.log("invariant_escrow_current_balances");
    let total_supply = BigNumber.from("0");
    let timestamp = BigNumber.from(await time.latest());

    for (let i = 0; i < ACCOUNT_NUM; i++) {
      let data = votingBalances[i];

      let balance = await votingEscrow["balanceOf(address)"](
        accounts[i].address
      );
      total_supply = total_supply.add(balance);

      if (data["unlockTime"].gt(timestamp) && data["value"].div(YEAR).gt("0")) {
        expect(balance.isZero()).to.equal(false);
      } else if (data["value"].isZero() || data["unlockTime"].lte(timestamp)) {
        expect(balance.isZero()).to.equal(true);
      }
    }
    expect(await votingEscrow["totalSupply()"]()).to.equal(total_supply);

    // console.log("invariant_historic_balances");
    total_supply = BigNumber.from("0");
    let blocknumber = (await time.latestBlock()) - 4;
    // console.log(blocknumber);

    for (let i = 0; i < ACCOUNT_NUM; i++) {
      total_supply = total_supply.add(
        await votingEscrow.balanceOfAt(accounts[i].address, blocknumber)
      );
    }

    expect(await votingEscrow.totalSupplyAt(blocknumber)).to.equal(
      total_supply
    );
  }

  let func = [
    "ruleCreateLock",
    "ruleIncreaseAmount",
    "ruleIncreaseUnlockTime",
    "ruleWithdraw",
    "ruleCheckpoint",
    "ruleAdvanceTime",
  ];

  describe("test_deposit_withdraw_voting", function () {
    //set arbitral number of repeats
    for (let x = 0; x < MAX_EXAMPLES; x++) {
      it(`Try ${x}`, async () => {
        let steps = Math.floor(Math.random() * (STATEFUL_STEP_COUNT - 1)) + 1;
        for (let i = 0; i < steps; i++) {
          let n = (await rdmValue(func.length)).toNumber();
          await eval(func[n])();
          await checkInvariants();
        }
      });
    }
  });

  afterEach(async () => {
    await snapshot.restore();
  });
});
