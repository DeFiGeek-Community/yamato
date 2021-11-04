import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import {
  deploy,
  setProvider,
  getDeploymentAddressPath,
  getDeploymentAddressPathWithTag,
} from "../src/deployUtil";
import { getLinkedProxy } from "../src/testUtil";
import { readFileSync, writeFileSync } from "fs";
import { Yamato, Yamato__factory } from "../typechain";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const p = await setProvider();
  const { ethers, deployments } = hre;
  const { getContractFactory } = ethers;

  const _cjpyosAddr = readFileSync(
    getDeploymentAddressPath("CjpyOS")
  ).toString();

  await deploy("PledgeLib", {
    args: [],
    getContractFactory,
    deployments,
    isDependency: true,
  }).catch((e) => console.trace(e.message));

  const PledgeLib = readFileSync(
    getDeploymentAddressPath("PledgeLib")
  ).toString();
  console.log(`PledgeLib: ${PledgeLib}`);

  const inst = await getLinkedProxy<Yamato, Yamato__factory>(
    "Yamato",
    [_cjpyosAddr],
    ["PledgeLib"]
  );
  const implAddr = await inst.getImplementation();

  console.log(
    `Yamato is deployed as ${
      inst.address
    } with impl(${implAddr}) by ${await inst.signer.getAddress()} on ${
      (await inst.provider.getNetwork()).name
    } at ${await inst.provider.getBlockNumber()}`
  );

  writeFileSync(
    getDeploymentAddressPathWithTag("Yamato", "ERC1967Proxy"),
    inst.address
  );
  writeFileSync(
    getDeploymentAddressPathWithTag("Yamato", "UUPSImpl"),
    implAddr
  );
};
export default func;
func.tags = ["Yamato"];
