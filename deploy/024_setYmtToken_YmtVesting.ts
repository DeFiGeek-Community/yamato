import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import {
  setProvider,
  getDeploymentAddressPath,
  getDeploymentAddressPathWithTag,
  getFoundation,
  setNetwork,
} from "../src/deployUtil";
import { readFileSync } from "fs";
import { genABI } from "../src/genABI";
import { Contract } from "ethers";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  setNetwork(hre.network.name);
  const p = await setProvider();

  const _ymtVestingAddr = readFileSync(
    getDeploymentAddressPath("YmtVesting")
  ).toString();
  const YmtVesting = new Contract(_ymtVestingAddr, genABI("YmtVesting"), p);

  const ymtAddr = readFileSync(getDeploymentAddressPath("YMT")).toString();

  if ((await YmtVesting.ymtTokenAddress()) == ymtAddr) {
    console.log(`log: YmtVesting.setYmtToken() skipped.`);
    return;
  }
  await (await YmtVesting.connect(getFoundation()).setYmtToken(ymtAddr)).wait();

  console.log(`log: YmtVesting.setYmtToken() executed.`);
};
export default func;
func.tags = ["setYmtToken"];
