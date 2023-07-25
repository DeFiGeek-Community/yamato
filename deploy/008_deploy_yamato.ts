import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import {
  deploy,
  setProvider,
  getDeploymentAddressPath,
  getDeploymentAddressPathWithTag,
  setNetwork,
} from "../src/deployUtil";
import { getLinkedProxy } from "../src/testUtil";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { Yamato, Yamato__factory } from "../typechain";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  if (existsSync(getDeploymentAddressPathWithTag("Yamato", "ERC1967Proxy")))
    return;

  setNetwork(hre.network.name);
  const p = await setProvider();
  const { ethers, deployments } = hre;
  const { getContractFactory } = ethers;

  const _currencyOSAddr = readFileSync(
    getDeploymentAddressPathWithTag("CurrencyOS", "ERC1967Proxy")
  ).toString();

  const inst = await getLinkedProxy<Yamato, Yamato__factory>(
    "Yamato",
    [_currencyOSAddr],
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
