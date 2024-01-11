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
  await runUpgrade(IMPL_NAME_BASE, [], {
    call: { fn: "initializeV2", args: [startTime] },
  });
  console.log("log: upgrade_FeePool.ts: upgrade executed.");
}
