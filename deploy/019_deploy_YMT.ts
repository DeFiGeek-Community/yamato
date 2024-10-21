import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { deploy, setNetwork, setProvider } from "../src/deployUtil";
import { getDeploymentAddressPath } from "../src/deployUtil";
import { existsSync, readFileSync } from "fs";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  if (existsSync(getDeploymentAddressPath("YMT"))) return;

  setNetwork(hre.network.name);
  const p = await setProvider();
  const { ethers, deployments } = hre;
  const { getContractFactory } = ethers;

  const multisigAddr = process.env.UUPS_PROXY_ADMIN_MULTISIG_ADDRESS;
  if (!multisigAddr) return console.log(`not admin address`);

  const ymtVestingAddr = readFileSync(
    getDeploymentAddressPath("YmtVesting")
  ).toString();

  await deploy("YMT", {
    args: [ymtVestingAddr, multisigAddr],
    getContractFactory,
    deployments,
  }).catch((e) => console.trace(e.message));
};
export default func;
func.tags = ["YMT"];
