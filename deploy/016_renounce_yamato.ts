import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import {
  setProvider,
  getDeploymentAddressPath,
  getDeploymentAddressPathWithTag,
  getFoundation,
} from "../src/deployUtil";
import { readFileSync } from "fs";
import { genABI } from "../src/genABI";
import { Contract } from "ethers";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const p = await setProvider();

  const _yamatoAddr = readFileSync(
    getDeploymentAddressPathWithTag("Yamato", "ERC1967Proxy")
  ).toString();
  const Yamato = new Contract(_yamatoAddr, genABI("Yamato"), p);

  const _yamatoHelperAddr = readFileSync(
    getDeploymentAddressPathWithTag("YamatoHelper", "ERC1967Proxy")
  ).toString();
  const YamatoHelper = new Contract(
    _yamatoHelperAddr,
    genABI("YamatoHelper"),
    p
  );

  await (await Yamato.connect(getFoundation()).revokeTester()).wait();
  console.log(`log: Yamato.revokeTester() executed.`);

  await (await YamatoHelper.connect(getFoundation()).revokeTester()).wait();
  console.log(`log: YamatoHelper.revokeTester() executed.`);
};
export default func;
func.tags = [""];
