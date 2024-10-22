import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import {
  deploy,
  setProvider,
  getDeploymentAddressPath,
  getDeploymentAddressPathWithTag,
  setNetwork,
} from "../../src/deployUtil";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { ScoreRegistry, ScoreRegistry__factory } from "../../typechain";
import { getLinkedProxy } from "../../src/testUtil";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const currency = process.env.CURRENCY;

  // CURRENCYが設定されていない場合は終了
  if (!currency) {
    console.error("CURRENCY environment variable is not set.");
    return;
  }

  if (
    existsSync(
      getDeploymentAddressPathWithTag("ScoreRegistry", "ERC1967Proxy", currency)
    )
  )
    return;

  setNetwork(hre.network.name);
  const p = await setProvider();
  const { ethers, deployments } = hre;
  const { getContractFactory } = ethers;

  const ymtMinterAddr = readFileSync(
    getDeploymentAddressPathWithTag("YmtMinter", "ERC1967Proxy", currency)
  ).toString();
  const yamatoAddr = readFileSync(
    getDeploymentAddressPathWithTag("Yamato", "ERC1967Proxy", currency)
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
    getDeploymentAddressPathWithTag("ScoreRegistry", "ERC1967Proxy", currency),
    inst.address
  );
  writeFileSync(
    getDeploymentAddressPathWithTag("ScoreRegistry", "UUPSImpl", currency),
    implAddr
  );
};
export default func;
func.tags = ["ScoreRegistry_V2"];
