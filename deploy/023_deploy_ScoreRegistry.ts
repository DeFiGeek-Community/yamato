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
import { getLinkedProxy } from "../src/testUtil";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  if (
    existsSync(getDeploymentAddressPathWithTag("ScoreRegistry", "ERC1967Proxy"))
  )
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

  const inst = await getLinkedProxy<ScoreRegistry, ScoreRegistry__factory>(
    "ScoreRegistry",
    [ymtMinterAddr, yamatoAddr],
    ["PledgeLib"]
  );
  const implAddr = await inst.getImplementation();

  console.log(
    `PriorityRegistry is deployed as ${
      inst.address
    } with impl(${implAddr}) by ${await inst.signer.getAddress()} on ${
      (await inst.provider.getNetwork()).name
    } at ${await inst.provider.getBlockNumber()}`
  );

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
