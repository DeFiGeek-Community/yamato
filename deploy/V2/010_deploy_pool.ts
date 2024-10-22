import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import {
  deploy,
  setProvider,
  getDeploymentAddressPath,
  getDeploymentAddressPathWithTag,
  setNetwork,
} from "../../src/deployUtil";
import { getLinkedProxy } from "../../src/testUtil";
import { existsSync, readFileSync, writeFileSync } from "fs";
import { Pool, Pool__factory } from "../../typechain";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const currency = process.env.CURRENCY;

  // CURRENCYが設定されていない場合は終了
  if (!currency) {
    console.error("CURRENCY environment variable is not set.");
    return;
  }

  if (
    existsSync(
      getDeploymentAddressPathWithTag("Yamato", "ERC1967Proxy", currency)
    ) &&
    existsSync(
      getDeploymentAddressPathWithTag("Pool", "ERC1967Proxy", currency)
    )
  )
    return;

  setNetwork(hre.network.name);
  const p = await setProvider();
  const { ethers, deployments } = hre;
  const { getContractFactory } = ethers;

  const _yamatoAddr = readFileSync(
    getDeploymentAddressPathWithTag("Yamato", "ERC1967Proxy", currency)
  ).toString();

  const inst = await getLinkedProxy<Pool, Pool__factory>(
    "Pool",
    [_yamatoAddr],
    ["PledgeLib"],
    2
  );
  const implAddr = await inst.getImplementation();

  console.log(
    `Pool is deployed as ${
      inst.address
    } with impl(${implAddr}) by ${await inst.signer.getAddress()} on ${
      (await inst.provider.getNetwork()).name
    } at ${await inst.provider.getBlockNumber()}`
  );

  writeFileSync(
    getDeploymentAddressPathWithTag("Pool", "ERC1967Proxy", currency),
    inst.address
  );
  writeFileSync(
    getDeploymentAddressPathWithTag("Pool", "UUPSImpl", currency),
    implAddr
  );
};
export default func;
func.tags = ["Pool_V2"];
