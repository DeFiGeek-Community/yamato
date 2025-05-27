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

  const _YMTAddr = readFileSync(getDeploymentAddressPath("YMT")).toString();
  const YMT = new Contract(_YMTAddr, genABI("YMT"), p);

  const ymtMinterAddr = readFileSync(
    getDeploymentAddressPathWithTag("YmtMinter", "ERC1967Proxy")
  ).toString();

  if ((await YMT.ymtMinter()) == ymtMinterAddr) {
    console.log(`log: YMT.setMinter() skipped.`);
    return;
  }
  await (await YMT.connect(getFoundation()).setMinter(ymtMinterAddr)).wait();

  console.log(`log: YMT.setMinter() executed.`);
};
export default func;
func.tags = ["setMinter"];
