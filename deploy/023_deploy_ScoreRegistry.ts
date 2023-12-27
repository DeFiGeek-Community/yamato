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
import { ScoreRegistry, ScoreRegistry__factory } from "../typechain";
import { getProxy } from "../src/testUtil";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  if (
    existsSync(getDeploymentAddressPathWithTag("ScoreRegistry", "ERC1967Proxy"))
  )
    return;
  if (!existsSync(getDeploymentAddressPathWithTag("Yamato", "ERC1967Proxy")))
    return;
  if (!existsSync(getDeploymentAddressPathWithTag("YmtMinter", "ERC1967Proxy")))
    return;

  setNetwork(hre.network.name);
  const p = await setProvider();
  const { ethers, deployments } = hre;
  const { getContractFactory } = ethers;

  const ymtMinterAddr = readFileSync(
    getDeploymentAddressPathWithTag("YmtMinter", "ERC1967Proxy")
  ).toString();
  const yamatoAddr = readFileSync(
    getDeploymentAddressPathWithTag("Yamato", "ERC1967Proxy")
  ).toString();

  const inst = await getProxy<ScoreRegistry, ScoreRegistry__factory>(
    "ScoreRegistry",
    [ymtMinterAddr, yamatoAddr]
  );
  const implAddr = await inst.getImplementation();

  writeFileSync(
    getDeploymentAddressPathWithTag("ScoreRegistry", "ERC1967Proxy"),
    inst.address
  );
  writeFileSync(
    getDeploymentAddressPathWithTag("ScoreRegistry", "UUPSImpl"),
    implAddr
  );
};
export default func;
func.tags = ["ScoreRegistry"];
