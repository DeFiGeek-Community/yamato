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
import { readFileSync, writeFileSync, existsSync } from "fs";
import { YamatoV4, YamatoV4__factory } from "../../typechain";

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
    )
  )
    return;

  setNetwork(hre.network.name);
  const p = await setProvider();
  const { ethers, deployments } = hre;
  const { getContractFactory } = ethers;

  const _currencyOSAddr = readFileSync(
    getDeploymentAddressPathWithTag("CurrencyOS", "ERC1967Proxy")
  ).toString();

  const inst = await getLinkedProxy<YamatoV4, YamatoV4__factory>(
    "Yamato",
    [_currencyOSAddr],
    ["PledgeLib"],
    4
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
    getDeploymentAddressPathWithTag("Yamato", "ERC1967Proxy", currency),
    inst.address
  );
  writeFileSync(
    getDeploymentAddressPathWithTag("Yamato", "UUPSImpl", currency),
    implAddr
  );
};
export default func;
func.tags = ["Yamato_V2"];
