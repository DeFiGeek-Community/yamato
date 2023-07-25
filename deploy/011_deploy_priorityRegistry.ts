import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import {
  deploy,
  setProvider,
  getDeploymentAddressPathWithTag,
  setNetwork,
} from "../src/deployUtil";
import { getLinkedProxy } from "../src/testUtil";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { PriorityRegistry, PriorityRegistry__factory } from "../typechain";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  if (
    existsSync(getDeploymentAddressPathWithTag("Yamato", "ERC1967Proxy")) &&
    existsSync(
      getDeploymentAddressPathWithTag("PriorityRegistry", "ERC1967Proxy")
    )
  )
    return;

  setNetwork(hre.network.name);
  const p = await setProvider();
  const { ethers, deployments } = hre;
  const { getContractFactory } = ethers;

  const _yamatoAddr = readFileSync(
    getDeploymentAddressPathWithTag("Yamato", "ERC1967Proxy")
  ).toString();

  const inst = await getLinkedProxy<
    PriorityRegistry,
    PriorityRegistry__factory
  >("PriorityRegistry", [_yamatoAddr], ["PledgeLib"]);
  const implAddr = await inst.getImplementation();

  console.log(
    `PriorityRegistry is deployed as ${
      inst.address
    } with impl(${implAddr}) by ${await inst.signer.getAddress()} on ${
      (await inst.provider.getNetwork()).name
    } at ${await inst.provider.getBlockNumber()}`
  );

  writeFileSync(
    getDeploymentAddressPathWithTag("PriorityRegistry", "ERC1967Proxy"),
    inst.address
  );
  writeFileSync(
    getDeploymentAddressPathWithTag("PriorityRegistry", "UUPSImpl"),
    implAddr
  );
};
export default func;
func.tags = ["PriorityRegistry"];
