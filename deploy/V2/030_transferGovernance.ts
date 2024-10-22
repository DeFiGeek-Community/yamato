import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import {
  setProvider,
  getDeploymentAddressPath,
  getDeploymentAddressPathWithTag,
  getFoundation,
  getMultisigGoverner,
  setNetwork,
} from "../../src/deployUtil";
import { readFileSync } from "fs";
import { genABI } from "../../src/genABI";
import { Contract } from "ethers";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const multisigAddr = process.env.UUPS_PROXY_ADMIN_MULTISIG_ADDRESS;
  if (!multisigAddr) return;

  const currency = process.env.CURRENCY;

  // CURRENCYが設定されていない場合は終了
  if (!currency) {
    console.error("CURRENCY environment variable is not set.");
    return;
  }

  setNetwork(hre.network.name);
  const p = await setProvider();

  const _priceFeedAddr = readFileSync(
    getDeploymentAddressPathWithTag("PriceFeed", "ERC1967Proxy", currency)
  ).toString();
  const PriceFeed = new Contract(_priceFeedAddr, genABI("PriceFeed"), p);
  const _feePoolAddr = readFileSync(
    getDeploymentAddressPathWithTag("FeePool", "ERC1967Proxy", currency)
  ).toString();
  const FeePool = new Contract(_feePoolAddr, genABI("FeePool"), p);
  const _currencyOSAddr = readFileSync(
    getDeploymentAddressPathWithTag("CurrencyOS", "ERC1967Proxy", currency)
  ).toString();
  const CurrencyOS = new Contract(_currencyOSAddr, genABI("CurrencyOS"), p);
  const _poolAddr = readFileSync(
    getDeploymentAddressPathWithTag("Pool", "ERC1967Proxy", currency)
  ).toString();
  const Pool = new Contract(_poolAddr, genABI("Pool"), p);
  const _priorityRegistryAddr = readFileSync(
    getDeploymentAddressPathWithTag(
      "PriorityRegistry",
      "ERC1967Proxy",
      currency
    )
  ).toString();
  const PriorityRegistry = new Contract(
    _priorityRegistryAddr,
    genABI("PriorityRegistry"),
    p
  );
  const _yamatoAddr = readFileSync(
    getDeploymentAddressPathWithTag("Yamato", "ERC1967Proxy", currency)
  ).toString();
  const Yamato = new Contract(_yamatoAddr, genABI("Yamato"), p);
  const _yamatoDepositorAddr = readFileSync(
    getDeploymentAddressPathWithTag("YamatoDepositor", "ERC1967Proxy", currency)
  ).toString();
  const YamatoDepositor = new Contract(
    _yamatoDepositorAddr,
    genABI("YamatoDepositor"),
    p
  );
  const _yamatoBorrowerAddr = readFileSync(
    getDeploymentAddressPathWithTag("YamatoBorrower", "ERC1967Proxy", currency)
  ).toString();
  const YamatoBorrower = new Contract(
    _yamatoBorrowerAddr,
    genABI("YamatoBorrower"),
    p
  );
  const _yamatoRepayerAddr = readFileSync(
    getDeploymentAddressPathWithTag("YamatoRepayer", "ERC1967Proxy", currency)
  ).toString();
  const YamatoRepayer = new Contract(
    _yamatoRepayerAddr,
    genABI("YamatoRepayer"),
    p
  );
  const _yamatoWithdrawerAddr = readFileSync(
    getDeploymentAddressPathWithTag(
      "YamatoWithdrawer",
      "ERC1967Proxy",
      currency
    )
  ).toString();
  const YamatoWithdrawer = new Contract(
    _yamatoWithdrawerAddr,
    genABI("YamatoWithdrawer"),
    p
  );
  const _yamatoRedeemerAddr = readFileSync(
    getDeploymentAddressPathWithTag("YamatoRedeemer", "ERC1967Proxy", currency)
  ).toString();
  const YamatoRedeemer = new Contract(
    _yamatoRedeemerAddr,
    genABI("YamatoRedeemer"),
    p
  );
  const _yamatoSweeperAddr = readFileSync(
    getDeploymentAddressPathWithTag("YamatoSweeper", "ERC1967Proxy", currency)
  ).toString();
  const YamatoSweeper = new Contract(
    _yamatoSweeperAddr,
    genABI("YamatoSweeper"),
    p
  );

  const _scoreRegistryAddr = readFileSync(
    getDeploymentAddressPathWithTag("ScoreRegistry", "ERC1967Proxy", currency)
  ).toString();
  const ScoreRegistry = new Contract(
    _scoreRegistryAddr,
    genABI("ScoreRegistry"),
    p
  );

  await (
    await PriceFeed.connect(getFoundation()).setGovernance(multisigAddr)
  ).wait();
  console.log(`log: PriceFeed.setGovernance(${multisigAddr}) executed.`);
  await (
    await FeePool.connect(getFoundation()).setGovernance(multisigAddr)
  ).wait();
  console.log(`log: FeePool.setGovernance(${multisigAddr}) executed.`);
  await (
    await CurrencyOS.connect(getFoundation()).setGovernance(multisigAddr)
  ).wait();
  console.log(`log: CurrencyOS.setGovernance(${multisigAddr}) executed.`);
  await (
    await Pool.connect(getFoundation()).setGovernance(multisigAddr)
  ).wait();
  console.log(`log: Pool.setGovernance(${multisigAddr}) executed.`);
  await (
    await PriorityRegistry.connect(getFoundation()).setGovernance(multisigAddr)
  ).wait();
  console.log(`log: PriorityRegistry.setGovernance(${multisigAddr}) executed.`);
  await (
    await Yamato.connect(getFoundation()).setGovernance(multisigAddr)
  ).wait();
  console.log(`log: Yamato.setGovernance(${multisigAddr}) executed.`);
  await (
    await YamatoDepositor.connect(getFoundation()).setGovernance(multisigAddr)
  ).wait();
  console.log(`log: YamatoDepositor.setGovernance(${multisigAddr}) executed.`);
  await (
    await YamatoBorrower.connect(getFoundation()).setGovernance(multisigAddr)
  ).wait();
  console.log(`log: YamatoBorrower.setGovernance(${multisigAddr}) executed.`);
  await (
    await YamatoRepayer.connect(getFoundation()).setGovernance(multisigAddr)
  ).wait();
  console.log(`log: YamatoRepayer.setGovernance(${multisigAddr}) executed.`);
  await (
    await YamatoWithdrawer.connect(getFoundation()).setGovernance(multisigAddr)
  ).wait();
  console.log(`log: YamatoWithdrawer.setGovernance(${multisigAddr}) executed.`);
  await (
    await YamatoRedeemer.connect(getFoundation()).setGovernance(multisigAddr)
  ).wait();
  console.log(`log: YamatoRedeemer.setGovernance(${multisigAddr}) executed.`);
  await (
    await YamatoSweeper.connect(getFoundation()).setGovernance(multisigAddr)
  ).wait();
  console.log(`log: YamatoSweeper.setGovernance(${multisigAddr}) executed.`);
  await (
    await ScoreRegistry.connect(getFoundation()).setGovernance(multisigAddr)
  ).wait();
  console.log(`log: ScoreRegistry.setGovernance(${multisigAddr}) executed.`);
};

export default func;
func.tags = ["transferGovernance_V2"];
