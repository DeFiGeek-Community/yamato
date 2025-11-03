import hre from 'hardhat';
import type { Address } from 'viem';
import { deployUUPS } from '../../core/uups-deployer';
import { loadAddress, loadProxyAddress, type NetworkName } from '../../core/address-manager';
import { getCurrency, getCurrencyContractName } from '../../core/currency-manager';
import { V2_CURRENCY_CONTRACTS, V1_CONTRACTS, requiresPledgeLib, CONTRACT_NAMES } from '../../core/contract-definitions';

/**
 * 通貨別ScoreRegistry デプロイ
 * 
 * CURRENCY環境変数で指定された通貨のScoreRegistryインスタンスをデプロイします。
 * PledgeLibをリンクします。
 * 
 * ⚠️ 注意:
 * - ScoreRegistryは他のコントラクトのデプロイ後にデプロイします
 * - YmtMinterとYamatoが必要です
 */
async function main() {
  const network = hre.network.name as NetworkName;
  const currency = getCurrency();
  
  console.log(`\n🌐 Network: ${network}`);
  console.log(`💱 Currency: ${currency}\n`);

  console.log('📖 Loading dependencies...');
  const ymtMinterAddr = loadProxyAddress(network, CONTRACT_NAMES.YmtMinter); // YmtMinterは全通貨共有
  const yamatoAddr = loadProxyAddress(network, CONTRACT_NAMES.Yamato, currency);
  const pledgeLibAddr = loadAddress(network, V1_CONTRACTS.PledgeLib);
  
  console.log(`   YmtMinter (shared): ${ymtMinterAddr}`);
  console.log(`   Yamato (${currency}): ${yamatoAddr}`);
  console.log(`   PledgeLib: ${pledgeLibAddr}`);
  console.log('✅ Dependencies loaded\n');

  const needsLibrary = requiresPledgeLib(V2_CURRENCY_CONTRACTS.ScoreRegistry, 'v2');

  const result = await deployUUPS({
    name: getCurrencyContractName('ScoreRegistry', currency),
    contractName: V2_CURRENCY_CONTRACTS.ScoreRegistry,
    initFunction: 'initialize',
    initArgs: [ymtMinterAddr, yamatoAddr],
    libraries: needsLibrary ? {
      'contracts/Dependencies/PledgeLib.sol:PledgeLib': pledgeLibAddr as `0x${string}`,
    } : undefined,
  });

  console.log(`\n✅ ScoreRegistry (${currency}) deployed!`);
  console.log(`   Implementation: ${result.implAddress}`);
  console.log(`   Proxy: ${result.proxyAddress}\n`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
