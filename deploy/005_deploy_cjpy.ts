import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { deploy, setProvider } from "../src/deployUtil";
import { 
getDeploymentAddressPath,
} from "../src/deployUtil";
import { readFileSync } from "fs";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  if(
    readFileSync(
      getDeploymentAddressPath("CJPY")
    ).toString()
  ) return;

  const p = await setProvider();
  const { ethers, deployments } = hre;
  const { getContractFactory } = ethers;

  await deploy("CJPY", {
    args: [],
    getContractFactory,
    deployments,
  }).catch((e) => console.trace(e.message));
};
export default func;
func.tags = ["CJPY"];
