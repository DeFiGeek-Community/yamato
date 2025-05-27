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

  const currencyOSAddr = readFileSync(
    getDeploymentAddressPathWithTag("CurrencyOS", "ERC1967Proxy")
  ).toString();
  const CurrencyOS = new Contract(currencyOSAddr, genABI("CurrencyOSV3"), p);

  const ymtAddr = readFileSync(getDeploymentAddressPath("YMT")).toString();
  const veYmtAddr = readFileSync(getDeploymentAddressPath("veYMT")).toString();
  const ymtMinterAddr = readFileSync(
    getDeploymentAddressPathWithTag("YmtMinter", "ERC1967Proxy")
  ).toString();
  const controllerAddr = readFileSync(
    getDeploymentAddressPathWithTag("ScoreWeightController", "ERC1967Proxy")
  ).toString();

  const gasLimit = 10000000;

  await (
    await CurrencyOS.connect(getFoundation()).setYMT(ymtAddr, { gasLimit })
  ).wait();
  await (
    await CurrencyOS.connect(getFoundation()).setVeYMT(veYmtAddr, { gasLimit })
  ).wait();
  await (
    await CurrencyOS.connect(getFoundation()).setYmtMinter(ymtMinterAddr, {
      gasLimit,
    })
  ).wait();
  await (
    await CurrencyOS.connect(getFoundation()).setScoreWeightController(
      controllerAddr,
      { gasLimit }
    )
  ).wait();

  console.log(`log: CurrencyOS.setAddress() executed.`);
};
export default func;
func.tags = ["setAddress"];
