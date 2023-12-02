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
  FeePool__factory,
} from "../../../../typechain";
import { getProxy } from "../../../../src/testUtil";
import { contractVersion } from "../../../param/version";

const DAY = 86400;
const WEEK = DAY * 7;
const MAX_EXAMPLES = 10;

describe("FeePoolV2", function () {
  let accounts: SignerWithAddress[];
  let YMT: Contract;
  let veYMT: Contract;
  let feePool: Contract;
  let snapshot: SnapshotRestorer;

  beforeEach(async function () {
    snapshot = await takeSnapshot();
    accounts = await ethers.getSigners();

    const ymt = await ethers.getContractFactory("YMT");
    const VeYMT = await ethers.getContractFactory("veYMT");

    YMT = await ymt.deploy();
    await YMT.deployed();

    veYMT = await VeYMT.deploy(YMT.address);
    await veYMT.deployed();

    feePool = await getProxy<FeePool, FeePool__factory>(
      contractVersion["FeePool"],
      [await time.latest()]
    );
    await feePool.setVeYMT(veYMT.address);
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

  it("test checkpoint total supply", async function () {
    const stAmount = generateUniqueRandomNumbers(MAX_EXAMPLES, 1e4, 100 * 1e4);
    const stLocktime = generateUniqueRandomNumbers(MAX_EXAMPLES, 1, 52);
    const stSleep = generateUniqueRandomNumbers(MAX_EXAMPLES, 1, 30);
    for (let i = 0; i < MAX_EXAMPLES; i++) {
      await YMT
        .connect(accounts[i])
        .approve(veYMT.address, ethers.constants.MaxUint256);
      await YMT
        .connect(accounts[0])
        .transfer(await accounts[i].address, ethers.utils.parseEther("1000"));
    }

    let finalLock = 0;
    for (let i = 0; i < MAX_EXAMPLES; i++) {
      const sleepTime = Math.floor(stSleep[i] * 86400);
      await ethers.provider.send("evm_increaseTime", [sleepTime]);
      const lockTime = (await time.latest()) + sleepTime + WEEK * stLocktime[i];
      finalLock = Math.max(finalLock, lockTime);

      await veYMT
        .connect(accounts[i])
        .createLock(
          BigNumber.from(stAmount[i].toFixed(0)).mul((1e14).toString()),
          Math.floor(lockTime)
        );
    }

    while ((await time.latest()) < finalLock) {
      const weekEpoch =
        Math.floor(((await time.latest()) + WEEK) / WEEK) * WEEK; // WEEK * WEEK;

      await time.increaseTo(weekEpoch);

      const weekBlock = await time.latestBlock();

      await ethers.provider.send("evm_increaseTime", [1]);

      // Max: 42 weeks
      // doing checkpoint 3 times is enough
      for (let i = 0; i < 3; i++) {
        await feePool.connect(accounts[0]).checkpointTotalSupply();
      }

      const expected = await veYMT.totalSupplyAt(weekBlock);
      const actual = await feePool.veSupply(weekEpoch);
      console.log(`expected: ${expected} actual: ${actual}`);
      expect(actual).to.equal(expected);
    }
  });
});
