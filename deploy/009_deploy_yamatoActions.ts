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
import { BaseContract, ContractFactory } from "ethers";
import {
  YamatoDepositor,
  YamatoBorrower,
  YamatoRepayer,
  YamatoWithdrawer,
  YamatoRedeemer,
  YamatoSweeper,
  YamatoDepositor__factory,
  YamatoBorrower__factory,
  YamatoRepayer__factory,
  YamatoWithdrawer__factory,
  YamatoRedeemer__factory,
  YamatoSweeper__factory,
} from "../typechain";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  setNetwork(hre.network.name);
  const p = await setProvider();
  const { ethers, deployments } = hre;
  const { getContractFactory } = ethers;

  if (
    !existsSync(getDeploymentAddressPathWithTag("Yamato", "ERC1967Proxy")) ||
    !existsSync(
      getDeploymentAddressPathWithTag("YamatoDepositor", "ERC1967Proxy")
    )
  ) {
    await deployYamatoAction<YamatoDepositor, YamatoDepositor__factory>(
      "Depositor"
    );
  }

  if (
    !existsSync(getDeploymentAddressPathWithTag("Yamato", "ERC1967Proxy")) ||
    !existsSync(
      getDeploymentAddressPathWithTag("YamatoBorrower", "ERC1967Proxy")
    )
  ) {
    await deployYamatoAction<YamatoBorrower, YamatoBorrower__factory>(
      "Borrower"
    );
  }

  if (
    !existsSync(getDeploymentAddressPathWithTag("Yamato", "ERC1967Proxy")) ||
    !existsSync(
      getDeploymentAddressPathWithTag("YamatoRepayer", "ERC1967Proxy")
    )
  ) {
    await deployYamatoAction<YamatoRepayer, YamatoRepayer__factory>("Repayer");
  }

  if (
    !existsSync(getDeploymentAddressPathWithTag("Yamato", "ERC1967Proxy")) ||
    !existsSync(
      getDeploymentAddressPathWithTag("YamatoWithdrawer", "ERC1967Proxy")
    )
  ) {
    await deployYamatoAction<YamatoWithdrawer, YamatoWithdrawer__factory>(
      "Withdrawer"
    );
  }

  if (
    !existsSync(getDeploymentAddressPathWithTag("Yamato", "ERC1967Proxy")) ||
    !existsSync(
      getDeploymentAddressPathWithTag("YamatoRedeemer", "ERC1967Proxy")
    )
  ) {
    await deployYamatoAction<YamatoRedeemer, YamatoRedeemer__factory>(
      "Redeemer"
    );
  }

  if (
    !existsSync(getDeploymentAddressPathWithTag("Yamato", "ERC1967Proxy")) ||
    !existsSync(
      getDeploymentAddressPathWithTag("YamatoSweeper", "ERC1967Proxy")
    )
  ) {
    await deployYamatoAction<YamatoSweeper, YamatoSweeper__factory>("Sweeper");
  }
};
export default func;
func.tags = ["Yamato"];

async function deployYamatoAction<
  T extends BaseContract,
  S extends ContractFactory
>(actionName) {
  console.log(`Yamato${actionName} is being deployed...`);

  const _yamatoAddr = readFileSync(
    getDeploymentAddressPathWithTag("Yamato", "ERC1967Proxy")
  ).toString();

  const inst = await getLinkedProxy<T, S>(
    `Yamato${actionName}`,
    [_yamatoAddr],
    ["PledgeLib"]
  );
  const implAddr = await (<any>inst).getImplementation();

  console.log(
    `Yamato${actionName} is deployed as ${
      inst.address
    } with impl(${implAddr}) by ${await inst.signer.getAddress()} on ${
      (await inst.provider.getNetwork()).name
    } at ${await inst.provider.getBlockNumber()}`
  );

  writeFileSync(
    getDeploymentAddressPathWithTag(`Yamato${actionName}`, "ERC1967Proxy"),
    inst.address
  );
  writeFileSync(
    getDeploymentAddressPathWithTag(`Yamato${actionName}`, "UUPSImpl"),
    implAddr
  );
}
