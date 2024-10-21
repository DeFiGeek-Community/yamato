import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import {
  deploy,
  setProvider,
  getDeploymentAddressPath,
  getDeploymentAddressPathWithTag,
  setNetwork,
} from "../src/deployUtil";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { YmtMinter, YmtMinter__factory } from "../typechain";
import { getProxy } from "../src/testUtil";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  if (existsSync(getDeploymentAddressPathWithTag("YmtMinter", "ERC1967Proxy")))
    return;

  setNetwork(hre.network.name);
  const p = await setProvider();
  const { ethers, deployments } = hre;
  const { getContractFactory } = ethers;

  const ymtAddr = readFileSync(getDeploymentAddressPath("YMT")).toString();
  const controllerAddr = readFileSync(
    getDeploymentAddressPathWithTag("ScoreWeightController", "ERC1967Proxy")
  ).toString();

  const inst = await getProxy<YmtMinter, YmtMinter__factory>("YmtMinter", [
    ymtAddr,
    controllerAddr,
  ]);
  const implAddr = await inst.getImplementation();

  console.log(
    `PriorityRegistry is deployed as ${
      inst.address
    } with impl(${implAddr}) by ${await inst.signer.getAddress()} on ${
      (await inst.provider.getNetwork()).name
    } at ${await inst.provider.getBlockNumber()}`
  );

  writeFileSync(
    getDeploymentAddressPathWithTag("YmtMinter", "ERC1967Proxy"),
    inst.address
  );
  writeFileSync(
    getDeploymentAddressPathWithTag("YmtMinter", "UUPSImpl"),
    implAddr
  );
};
export default func;
func.tags = ["YmtMinter"];
