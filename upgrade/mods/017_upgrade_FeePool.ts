import { runUpgrade } from "../../src/upgradeUtil";
import {
  setProvider,
  getDeploymentAddressPath,
  getDeploymentAddressPathWithTag,
  getFoundation,
  setNetwork,
} from "../../src/deployUtil";
import { readFileSync } from "fs";
import { genABI } from "../../src/genABI";
import { Contract } from "ethers";

const IMPL_NAME_BASE = "FeePool";

export default async function main() {
  setNetwork(process.env.NETWORK);
  const p = await setProvider();

  const _YMTAddr = readFileSync(getDeploymentAddressPath("YMT")).toString();
  const YMT = new Contract(_YMTAddr, genABI("YMT"), p);
  const startTime = await YMT.startTime();
  const threeMonthsInSeconds = 3 * 30 * 24 * 60 * 60;
  const startTimePlusThreeMonths = startTime.add(threeMonthsInSeconds);
  console.log(Number(startTime))
  console.log(Number(startTimePlusThreeMonths))
  await runUpgrade(IMPL_NAME_BASE, [], {
    call: { fn: "initializeV2", args: [startTimePlusThreeMonths] },
  });
  console.log("log: upgrade_FeePool.ts: upgrade executed.");
}

// main();
