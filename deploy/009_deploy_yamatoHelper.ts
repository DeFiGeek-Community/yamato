import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import {
  deploy,
  setProvider,
  getDeploymentAddressPathWithTag,
} from "../src/deployUtil";
import { getLinkedProxy } from "../src/testUtil";
import { readFileSync, writeFileSync } from "fs";
import { YamatoHelper, YamatoHelper__factory } from "../typechain";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const p = await setProvider();
  const { ethers, deployments } = hre;
  const { getContractFactory } = ethers;

  const _yamatoAddr = readFileSync(
    getDeploymentAddressPathWithTag("Yamato", "ERC1967Proxy")
  ).toString();

  const inst = await getLinkedProxy<YamatoHelper, YamatoHelper__factory>(
    "YamatoHelper",
    [_yamatoAddr],
    ["PledgeLib"]
  );
  const implAddr = await inst.getImplementation();

  console.log(
    `YamatoHelper is deployed as ${
      inst.address
    } with impl(${implAddr}) by ${await inst.signer.getAddress()} on ${
      (await inst.provider.getNetwork()).name
    } at ${await inst.provider.getBlockNumber()}`
  );

  writeFileSync(
    getDeploymentAddressPathWithTag("YamatoHelper", "ERC1967Proxy"),
    inst.address
  );
  writeFileSync(
    getDeploymentAddressPathWithTag("YamatoHelper", "UUPSImpl"),
    implAddr
  );
};
export default func;
func.tags = ["Yamato"];
