import hre from 'hardhat';
import { loadProxyAddress, type NetworkName } from '../core/address-manager';
import { getCurrency } from '../core/currency-manager';
import { getDeployerAddress, getMultisigAddress, readGovernance, sendFromDeployer } from '../core/governance';
import { V2_CONTRACTS, V2_CURRENCY_CONTRACTS, V1_CONTRACTS, CONTRACT_NAMES } from '../core/contract-definitions';

/**
 * v2.0 ガバナンス移譲
 *
 * 通貨別コントラクトと YmtOS の移譲先（pendingGovernance）をマルチシグに設定します。
 * 承認は v2-accept-governance.ts で行います。
 *
 * setGovernance は現在の governance しか呼べないため、デプロイ用アカウントから直接送信します。
 *
 * 送信前に全コントラクトの状態を確認し、次のものは送信しません。
 * - governance がマルチシグ（移譲済み）
 * - pendingGovernance がマルチシグ（移譲先を設定済み）
 * governance がデプロイ用アカウントでもマルチシグでもないコントラクトがあれば、何も送信せずに終了します。
 * YmtOS は全通貨で共有のため、最初に実行した通貨で移譲され、以降の実行では対象外になります。
 *
 * 対象コントラクト:
 * - YmtOS (共有)
 * - PriceFeed (通貨別)
 * - CurrencyOS (通貨別)
 * - Pool (通貨別)
 * - PriorityRegistry (通貨別)
 * - Yamato (通貨別)
 * - YamatoDepositor (通貨別)
 * - YamatoBorrower (通貨別)
 * - YamatoRepayer (通貨別)
 * - YamatoWithdrawer (通貨別)
 * - YamatoRedeemer (通貨別)
 * - YamatoSweeper (通貨別)
 * - ScoreRegistry (通貨別)
 */
async function main() {
  const network = hre.network.name as NetworkName;
  const currency = getCurrency();
  const multisig = getMultisigAddress(network);
  const deployer = await getDeployerAddress();

  console.log(`\n🌐 Network: ${network}`);
  console.log(`💱 Currency: ${currency}`);
  console.log(`👤 Deployer: ${deployer}`);
  console.log(`🔐 Multisig: ${multisig}\n`);

  const priceFeedContractName = currency === 'CUSD'
    ? V2_CONTRACTS.PriceFeedSingle
    : V1_CONTRACTS.PriceFeed;

  const contracts = [
    { name: CONTRACT_NAMES.YmtOS, contractName: V2_CONTRACTS.YmtOS, address: loadProxyAddress(network, CONTRACT_NAMES.YmtOS) },
    { name: `PriceFeed (${currency})`, contractName: priceFeedContractName, address: loadProxyAddress(network, currency === 'CUSD' ? CONTRACT_NAMES.PriceFeedSingle : CONTRACT_NAMES.PriceFeed, currency) },
    { name: `CurrencyOS (${currency})`, contractName: V2_CURRENCY_CONTRACTS.CurrencyOS, address: loadProxyAddress(network, CONTRACT_NAMES.CurrencyOS, currency) },
    { name: `Pool (${currency})`, contractName: V2_CURRENCY_CONTRACTS.Pool, address: loadProxyAddress(network, CONTRACT_NAMES.Pool, currency) },
    { name: `PriorityRegistry (${currency})`, contractName: V2_CURRENCY_CONTRACTS.PriorityRegistry, address: loadProxyAddress(network, CONTRACT_NAMES.PriorityRegistry, currency) },
    { name: `Yamato (${currency})`, contractName: V2_CURRENCY_CONTRACTS.Yamato, address: loadProxyAddress(network, CONTRACT_NAMES.Yamato, currency) },
    { name: `YamatoDepositor (${currency})`, contractName: V2_CURRENCY_CONTRACTS.YamatoDepositor, address: loadProxyAddress(network, CONTRACT_NAMES.YamatoDepositor, currency) },
    { name: `YamatoBorrower (${currency})`, contractName: V2_CURRENCY_CONTRACTS.YamatoBorrower, address: loadProxyAddress(network, CONTRACT_NAMES.YamatoBorrower, currency) },
    { name: `YamatoRepayer (${currency})`, contractName: V2_CURRENCY_CONTRACTS.YamatoRepayer, address: loadProxyAddress(network, CONTRACT_NAMES.YamatoRepayer, currency) },
    { name: `YamatoWithdrawer (${currency})`, contractName: V2_CURRENCY_CONTRACTS.YamatoWithdrawer, address: loadProxyAddress(network, CONTRACT_NAMES.YamatoWithdrawer, currency) },
    { name: `YamatoRedeemer (${currency})`, contractName: V2_CURRENCY_CONTRACTS.YamatoRedeemer, address: loadProxyAddress(network, CONTRACT_NAMES.YamatoRedeemer, currency) },
    { name: `YamatoSweeper (${currency})`, contractName: V2_CURRENCY_CONTRACTS.YamatoSweeper, address: loadProxyAddress(network, CONTRACT_NAMES.YamatoSweeper, currency) },
    { name: `ScoreRegistry (${currency})`, contractName: V2_CURRENCY_CONTRACTS.ScoreRegistry, address: loadProxyAddress(network, CONTRACT_NAMES.ScoreRegistry, currency) },
  ];

  console.log('🔍 Checking governance state...\n');
  const plan = [];
  for (const contract of contracts) {
    const state = await readGovernance(contract.address);
    const action =
      state.governance === multisig ? 'done'
      : state.pendingGovernance === multisig ? 'pending'
      : state.governance === deployer ? 'transfer'
      : 'blocked';
    plan.push({ ...contract, ...state, action });
    console.log(`   ${action.padEnd(8)} ${contract.name}  governance=${state.governance}  pending=${state.pendingGovernance}`);
  }

  const blocked = plan.filter((p) => p.action === 'blocked');
  if (blocked.length > 0) {
    throw new Error(
      `Nothing was sent. governance is neither the deployer nor the multisig for: ${blocked.map((p) => p.name).join(', ')}`
    );
  }

  const targets = plan.filter((p) => p.action === 'transfer');
  console.log(`\n🔄 Transferring ${targets.length} contract(s)...\n`);
  for (const target of targets) {
    console.log(`🔄 ${target.name}.setGovernance(${multisig})`);
    const instance = await hre.viem.getContractAt(target.contractName, target.address);
    await sendFromDeployer({
      network,
      address: target.address,
      abi: instance.abi,
      functionName: 'setGovernance',
      args: [multisig],
    });
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`\n✅ Governance transfer completed!`);
  console.log(`\n📊 Summary (${currency}):`);
  console.log(`   Transferred now:        ${targets.length}`);
  console.log(`   Already pending:        ${plan.filter((p) => p.action === 'pending').length}`);
  console.log(`   Already multisig-owned: ${plan.filter((p) => p.action === 'done').length}`);
  console.log(`\n📝 Next step: run v2-accept-governance.ts`);
  console.log(`\n${'='.repeat(60)}\n`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
