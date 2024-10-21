import { ethers } from "hardhat";
import { BigNumber } from "ethers";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { ScoreRegistry } from "../../typechain";

const ACCOUNT_NUM = 5;
const MOUNT_DECIMALS = 3;

export const ScoreRegistryHelper = {
  setWorkingSupply: async (scoreRegistry: ScoreRegistry, amount: BigNumber) => {
    await ethers.provider.send("hardhat_setStorageAt", [
      scoreRegistry.address,
      "0x6d", // workingSupply slot
      ethers.utils.hexZeroPad(amount.toHexString(), 32),
    ]);
  },
  setWorkingBalance: async (
    scoreRegistry: ScoreRegistry,
    account: string,
    amount: BigNumber
  ) => {
    const baseSlot = ethers.BigNumber.from("0x6c"); // workingBalances base slot
    const accountHash = ethers.utils.keccak256(
      ethers.utils.defaultAbiCoder.encode(
        ["address", "uint256"],
        [account, baseSlot]
      )
    );
    const storageSlot = ethers.BigNumber.from(accountHash); // to QUANTITY
    await ethers.provider.send("hardhat_setStorageAt", [
      scoreRegistry.address,
      ethers.utils.hexZeroPad(storageSlot.toHexString(), 32), // workingBalance slot
      ethers.utils.hexZeroPad(amount.toHexString(), 32),
    ]);
  },
  getStates: async function (scoreRegistry: ScoreRegistry, address: string) {
    const period = await scoreRegistry.period();
    return {
      period,
      periodTimestamp: await scoreRegistry.periodTimestamp(period),
      integrateInvSupply: await scoreRegistry.integrateInvSupply(period),
      integrateFraction: await scoreRegistry.integrateFraction(address),
      integrateInvSupplyOf: await scoreRegistry.integrateInvSupplyOf(address),
      integrateCheckpointOf: await scoreRegistry.integrateCheckpointOf(address),
      timestamp: await time.latest(),
      futureEpochTime: await scoreRegistry.futureEpochTime(),
      inflationRate: await scoreRegistry.inflationRate(),
      workingSupply: await scoreRegistry.workingSupply(),
    };
  },
};

export function randomBigValue(min: number, max: number): BigNumber {
  return BigNumber.from(
    Math.floor(Math.random() * (max - min) + min).toString()
  );
}

export function randomValue(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min) + min);
}

export function getRandomAccountNum(): number {
  return Math.floor(Math.random() * ACCOUNT_NUM); //0~9 integer
}

export function getRandomWeeks(): BigNumber {
  return randomBigValue(1, 12);
}

export function getRandomAmounts(): BigNumber {
  return randomBigValue(
    1 * 10 ** MOUNT_DECIMALS,
    100 * 10 ** MOUNT_DECIMALS
  ).mul(BigNumber.from(10).pow(18 - MOUNT_DECIMALS));
}

export function getRandomsTime(): BigNumber {
  return randomBigValue(0, 86400 * 3);
}

export function fee(amount: BigNumber): BigNumber {
  return amount.sub(amount.div(1000));
}

export function approx(
  value: BigNumber,
  target: BigNumber,
  tol: BigNumber
): boolean {
  if (value.isZero() && target.isZero()) {
    return true;
  }

  const diff = value.sub(target).abs();
  const sum = value.add(target);
  const ratio = diff.mul(2).mul(BigNumber.from(10).pow(20)).div(sum);

  return ratio.lte(tol);
}

export function approxEqual(actual, expected, tolerance) {
  // 差の絶対値を計算
  const diff = actual.sub(expected).abs();

  // 差が許容誤差以下であるかどうかを確認
  return diff.lte(tolerance);
}

export function generateUniqueRandomNumbers(
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

export async function gasCostOf(tx) {
  const receipt = await tx.wait();
  return receipt.gasUsed.mul(receipt.effectiveGasPrice);
}
