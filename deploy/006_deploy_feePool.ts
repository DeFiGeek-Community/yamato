import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import {
  deploy,
  setProvider,
  getDeploymentAddressPathWithTag,
} from "../src/deployUtil";
import { readFileSync } from "fs";
import { FeePool, FeePool__factory } from "../typechain";
import { getProxy } from "../src/testUtil";
import { writeFileSync } from "fs";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  if(
    readFileSync(
      getDeploymentAddressPathWithTag("FeePool", "ERC1967Proxy")
    ).toString()
  ) return;

  const p = await setProvider();
  const { ethers, deployments } = hre;
  const { getContractFactory } = ethers;

  const inst = await getProxy<FeePool, FeePool__factory>("FeePool", []);
  const implAddr = await inst.getImplementation();
  console.log(
    `FeePool is deployed as ${
      inst.address
    } with impl(${implAddr}) by ${await inst.signer.getAddress()} on ${
      (await inst.provider.getNetwork()).name
    } at ${await inst.provider.getBlockNumber()}`
  );

  writeFileSync(
    getDeploymentAddressPathWithTag("FeePool", "ERC1967Proxy"),
    inst.address
  );
  writeFileSync(
    getDeploymentAddressPathWithTag("FeePool", "UUPSImpl"),
    implAddr
  );
};
export default func;
func.tags = ["FeePool"];
