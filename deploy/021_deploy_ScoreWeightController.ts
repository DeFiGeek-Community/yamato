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
import {
  ScoreWeightController,
  ScoreWeightController__factory,
} from "../typechain";
import { getProxy } from "../src/testUtil";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  if (
    existsSync(
      getDeploymentAddressPathWithTag("ScoreWeightController", "ERC1967Proxy")
    )
  )
    return;
  if (existsSync(getDeploymentAddressPath("YMT"))) return;
  if (existsSync(getDeploymentAddressPath("veYMT"))) return;

  setNetwork(hre.network.name);
  const p = await setProvider();
  const { ethers, deployments } = hre;
  const { getContractFactory } = ethers;

  const ymtAddr = readFileSync(getDeploymentAddressPath("YMT")).toString();
  const veYmtAddr = readFileSync(getDeploymentAddressPath("veYMT")).toString();

  const inst = await getProxy<
    ScoreWeightController,
    ScoreWeightController__factory
  >("ScoreWeightController", [ymtAddr, veYmtAddr]);
  const implAddr = await inst.getImplementation();

  writeFileSync(
    getDeploymentAddressPathWithTag("ScoreWeightController", "ERC1967Proxy"),
    inst.address
  );
  writeFileSync(
    getDeploymentAddressPathWithTag("ScoreWeightController", "UUPSImpl"),
    implAddr
  );
};
export default func;
func.tags = ["ScoreWeightController"];
