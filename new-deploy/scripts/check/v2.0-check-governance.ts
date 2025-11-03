import hre from 'hardhat';
import { loadProxyAddress, type NetworkName } from '../core/address-manager';
import { getNetworkConfig } from '../../config/networks';
import { getCurrency, getCurrencyContractName } from '../core/currency-manager';
import { V2_CONTRACTS, V2_CURRENCY_CONTRACTS, CONTRACT_NAMES } from '../core/contract-definitions';
import { getPriceFeedContractName } from '../core/currency-manager';

/**
 * v2.0 ガバナンス確認スクリプト
 * 
 * 以下のコントラクトのガバナンスアドレスを確認します：
 * - YmtOS (governance)
 * - 通貨別コントラクト (governance)
 * 
 * 使用方法:
 *   CURRENCY=CUSD npx hardhat run scripts/check/v2.0-check-governance.ts --network localhost
 */
async function main() {
  const network = hre.network.name as NetworkName;
  const currency = getCurrency();
  
  console.log(`\n🔍 Checking v2.0 governance on ${network}...`);
  console.log(`💱 Currency: ${currency}\n`);

  const networkConfig = getNetworkConfig(network);
  const multisigAddress = networkConfig.safeAddress;

  if (!multisigAddress) {
    console.warn(`⚠️  SAFE_ADDRESS_${network.toUpperCase()} is not set. Skipping governance checks.`);
    return;
  }

  const priceFeedContractName = getPriceFeedContractName(currency);
  
  const contracts = [
    {
      name: CONTRACT_NAMES.YmtOS,
      contractName: V2_CONTRACTS.YmtOS,
      governanceFunction: 'governance',
      useCurrency: false,
    },
    {
      name: priceFeedContractName,
      contractName: currency === 'CUSD' ? V2_CONTRACTS.PriceFeedSingle : V1_CONTRACTS.PriceFeed,
      governanceFunction: 'governance',
      useCurrency: true,
    },
    {
      name: CONTRACT_NAMES.CurrencyOS,
      contractName: V2_CURRENCY_CONTRACTS.CurrencyOS,
      governanceFunction: 'governance',
      useCurrency: true,
    },
    {
      name: CONTRACT_NAMES.Pool,
      contractName: V2_CURRENCY_CONTRACTS.Pool,
      governanceFunction: 'governance',
      useCurrency: true,
    },
    {
      name: CONTRACT_NAMES.PriorityRegistry,
      contractName: V2_CURRENCY_CONTRACTS.PriorityRegistry,
      governanceFunction: 'governance',
      useCurrency: true,
    },
    {
      name: CONTRACT_NAMES.Yamato,
      contractName: V2_CURRENCY_CONTRACTS.Yamato,
      governanceFunction: 'governance',
      useCurrency: true,
    },
    {
      name: CONTRACT_NAMES.YamatoDepositor,
      contractName: V2_CURRENCY_CONTRACTS.YamatoDepositor,
      governanceFunction: 'governance',
      useCurrency: true,
    },
    {
      name: CONTRACT_NAMES.YamatoBorrower,
      contractName: V2_CURRENCY_CONTRACTS.YamatoBorrower,
      governanceFunction: 'governance',
      useCurrency: true,
    },
    {
      name: CONTRACT_NAMES.YamatoRepayer,
      contractName: V2_CURRENCY_CONTRACTS.YamatoRepayer,
      governanceFunction: 'governance',
      useCurrency: true,
    },
    {
      name: CONTRACT_NAMES.YamatoWithdrawer,
      contractName: V2_CURRENCY_CONTRACTS.YamatoWithdrawer,
      governanceFunction: 'governance',
      useCurrency: true,
    },
    {
      name: CONTRACT_NAMES.YamatoRedeemer,
      contractName: V2_CURRENCY_CONTRACTS.YamatoRedeemer,
      governanceFunction: 'governance',
      useCurrency: true,
    },
    {
      name: CONTRACT_NAMES.YamatoSweeper,
      contractName: V2_CURRENCY_CONTRACTS.YamatoSweeper,
      governanceFunction: 'governance',
      useCurrency: true,
    },
    {
      name: CONTRACT_NAMES.ScoreRegistry,
      contractName: V2_CURRENCY_CONTRACTS.ScoreRegistry,
      governanceFunction: 'governance',
      useCurrency: true,
    },
  ];

  console.log('='.repeat(60));
  console.log(`🛡️  Checking Governance Addresses (${currency})`);
  console.log('='.repeat(60) + '\n');

  let governanceCheckPassed = 0;
  let governanceCheckFailed = 0;

  for (const { name, contractName, governanceFunction, useCurrency } of contracts) {
    try {
      const address = loadProxyAddress(network, name, useCurrency ? currency : undefined);
      const contractInstance = await hre.viem.getContractAt(contractName, address);
      const governanceAddress = await contractInstance.read[governanceFunction]() as `0x${string}`;
      
      const matches = governanceAddress.toLowerCase() === multisigAddress.toLowerCase();
      
      const displayName = useCurrency ? `${name} (${currency})` : name;
      console.log(`📋 ${displayName}:`);
      console.log(`   ${governanceFunction}: ${governanceAddress}`);
      if (matches) {
        console.log(`   ✅ Match: ${multisigAddress}`);
        governanceCheckPassed++;
      } else {
        console.log(`   ❌ Expected: ${multisigAddress}`);
        governanceCheckFailed++;
      }
    } catch (error) {
      const displayName = useCurrency ? `${name} (${currency})` : name;
      console.log(`❌ ${displayName}: Error - ${error instanceof Error ? error.message : error}`);
      governanceCheckFailed++;
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('📊 Governance Check Summary');
  console.log('='.repeat(60));
  console.log(`✅ Passed: ${governanceCheckPassed}/${contracts.length}`);
  console.log(`❌ Failed: ${governanceCheckFailed}/${contracts.length}`);
  
  if (governanceCheckPassed === contracts.length && governanceCheckFailed === 0) {
    console.log(`\n🎉 All governance checks passed!`);
  } else {
    console.log(`\n⚠️  Some governance checks failed. Please review the output above.`);
  }
  console.log('='.repeat(60) + '\n');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });

