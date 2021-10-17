import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import {
  setProvider,
  getDeploymentAddressPath,
  getFoundation,
} from "../src/deployUtil";
import { readFileSync } from "fs";
import { genABI } from "../src/genABI";
import { Contract } from "ethers";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const p = await setProvider();

  const _yamatoAddr = readFileSync(
    getDeploymentAddressPath("Yamato")
  ).toString();
  const Yamato = new Contract(_yamatoAddr, genABI("Yamato"), p);

  await (await Yamato.connect(await getFoundation()).revokeTester()).wait();

  console.log(`log: Yamato.revokeTester() executed.`);
};
export default func;
func.tags = [""];
