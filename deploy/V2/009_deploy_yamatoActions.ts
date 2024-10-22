import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import {
  deploy,
  setProvider,
  getDeploymentAddressPathWithTag,
  setNetwork,
} from "../../src/deployUtil";
import { getLinkedProxy } from "../../src/testUtil";
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
} from "../../typechain";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  setNetwork(hre.network.name);
  const p = await setProvider();
  const { ethers, deployments } = hre;
  const { getContractFactory } = ethers;

  const currency = process.env.CURRENCY;

  // CURRENCYが設定されていない場合は終了
  if (!currency) {
    console.error("CURRENCY environment variable is not set.");
    return;
  }

  if (
    !existsSync(
      getDeploymentAddressPathWithTag("Yamato", "ERC1967Proxy", currency)
    ) ||
    !existsSync(
      getDeploymentAddressPathWithTag(
        "YamatoDepositor",
        "ERC1967Proxy",
        currency
      )
    )
  ) {
    await deployYamatoAction<YamatoDepositor, YamatoDepositor__factory>(
      "Depositor",
      3,
      currency
    );
  }

  if (
    !existsSync(
      getDeploymentAddressPathWithTag("Yamato", "ERC1967Proxy", currency)
    ) ||
    !existsSync(
      getDeploymentAddressPathWithTag(
        "YamatoBorrower",
        "ERC1967Proxy",
        currency
      )
    )
  ) {
    await deployYamatoAction<YamatoBorrower, YamatoBorrower__factory>(
      "Borrower",
      2,
      currency
    );
  }

  if (
    !existsSync(
      getDeploymentAddressPathWithTag("Yamato", "ERC1967Proxy", currency)
    ) ||
    !existsSync(
      getDeploymentAddressPathWithTag("YamatoRepayer", "ERC1967Proxy", currency)
    )
  ) {
    await deployYamatoAction<YamatoRepayer, YamatoRepayer__factory>(
      "Repayer",
      3,
      currency
    );
  }

  if (
    !existsSync(
      getDeploymentAddressPathWithTag("Yamato", "ERC1967Proxy", currency)
    ) ||
    !existsSync(
      getDeploymentAddressPathWithTag(
        "YamatoWithdrawer",
        "ERC1967Proxy",
        currency
      )
    )
  ) {
    await deployYamatoAction<YamatoWithdrawer, YamatoWithdrawer__factory>(
      "Withdrawer",
      3,
      currency
    );
  }

  if (
    !existsSync(
      getDeploymentAddressPathWithTag("Yamato", "ERC1967Proxy", currency)
    ) ||
    !existsSync(
      getDeploymentAddressPathWithTag(
        "YamatoRedeemer",
        "ERC1967Proxy",
        currency
      )
    )
  ) {
    await deployYamatoAction<YamatoRedeemer, YamatoRedeemer__factory>(
      "Redeemer",
      5,
      currency
    );
  }

  if (
    !existsSync(
      getDeploymentAddressPathWithTag("Yamato", "ERC1967Proxy", currency)
    ) ||
    !existsSync(
      getDeploymentAddressPathWithTag("YamatoSweeper", "ERC1967Proxy", currency)
    )
  ) {
    await deployYamatoAction<YamatoSweeper, YamatoSweeper__factory>(
      "Sweeper",
      3,
      currency
    );
  }
};
export default func;
func.tags = ["YamatoAction_V2"];

async function deployYamatoAction<
  T extends BaseContract,
  S extends ContractFactory
>(actionName, versionSpecification?: number | undefined, currency?: string) {
  console.log(`Yamato${actionName} is being deployed...`);

  const _yamatoAddr = readFileSync(
    getDeploymentAddressPathWithTag("Yamato", "ERC1967Proxy", currency)
  ).toString();

  const inst = await getLinkedProxy<T, S>(
    `Yamato${actionName}`,
    [_yamatoAddr],
    ["PledgeLib"],
    versionSpecification
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
    getDeploymentAddressPathWithTag(
      `Yamato${actionName}`,
      "ERC1967Proxy",
      currency
    ),
    inst.address
  );
  writeFileSync(
    getDeploymentAddressPathWithTag(
      `Yamato${actionName}`,
      "UUPSImpl",
      currency
    ),
    implAddr
  );
}
