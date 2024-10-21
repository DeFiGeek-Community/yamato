import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import {
  setProvider,
  getDeploymentAddressPath,
  getDeploymentAddressPathWithTag,
  getFoundation,
  getMultisigGoverner,
  setNetwork,
} from "../src/deployUtil";
import { readFileSync } from "fs";
import { genABI } from "../src/genABI";
import { Contract } from "ethers";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const multisigAddr = process.env.UUPS_PROXY_ADMIN_MULTISIG_ADDRESS;
  if (!multisigAddr) return;

  setNetwork(hre.network.name);
  const p = await setProvider();

  const _YMTAddr = readFileSync(getDeploymentAddressPath("YMT")).toString();
  const YMT = new Contract(_YMTAddr, genABI("YMT"), p);

  const _ymtVestingAddr = readFileSync(
    getDeploymentAddressPath("YmtVesting")
  ).toString();
  const YmtVesting = new Contract(_ymtVestingAddr, genABI("YmtVesting"), p);

  const _minterAddr = readFileSync(
    getDeploymentAddressPathWithTag("YmtMinter", "ERC1967Proxy")
  ).toString();
  const YmtMinter = new Contract(_minterAddr, genABI("YmtMinter"), p);

  const _controllerAddr = readFileSync(
    getDeploymentAddressPathWithTag("ScoreWeightController", "ERC1967Proxy")
  ).toString();
  const ScoreWeightController = new Contract(
    _controllerAddr,
    genABI("ScoreWeightController"),
    p
  );

  const _scoreRegistryAddr = readFileSync(
    getDeploymentAddressPathWithTag("ScoreRegistry", "ERC1967Proxy")
  ).toString();
  const ScoreRegistry = new Contract(
    _scoreRegistryAddr,
    genABI("ScoreRegistry"),
    p
  );

  await (await YMT.connect(getFoundation()).setAdmin(multisigAddr)).wait();
  console.log(`log: YMT.setAdmin(${multisigAddr}) executed.`);

  await (
    await YmtVesting.connect(getFoundation()).setAdmin(multisigAddr)
  ).wait();
  console.log(`log: YmtVesting.setAdmin(${multisigAddr}) executed.`);

  await (
    await YmtMinter.connect(getFoundation()).setGovernance(multisigAddr)
  ).wait();
  console.log(`log: YmtMinter.setGovernance(${multisigAddr}) executed.`);

  await (
    await ScoreWeightController.connect(getFoundation()).setGovernance(
      multisigAddr
    )
  ).wait();
  console.log(
    `log: ScoreWeightController.setGovernance(${multisigAddr}) executed.`
  );

  await (
    await ScoreRegistry.connect(getFoundation()).setGovernance(multisigAddr)
  ).wait();
  console.log(`log: ScoreRegistry.setGovernance(${multisigAddr}) executed.`);
};

export default func;
func.tags = ["transferGovernanceV15"];
