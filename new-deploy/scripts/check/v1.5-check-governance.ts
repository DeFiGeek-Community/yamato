import hre from 'hardhat';
import { loadProxyAddress, loadAddress, type NetworkName } from '../core/address-manager';
import { getNetworkConfig } from '../../config/networks';
import { V1_5_CONTRACTS, V1_CONTRACTS, CONTRACT_NAMES } from '../core/contract-definitions';

/**
 * v1.5 ガバナンス確認スクリプト
 * 
 * 以下のコントラクトのガバナンスアドレスを確認します：
 * - YmtMinter (governance)
 * - YmtVesting (contractAdmin)
 * - YMT (admin)
 * - Yamato (governance)
 * - ScoreRegistry (governance)
 * - ScoreWeightController (governance)
 * - FeePool (governance)
 * - CurrencyOS (governance)
 */
async function main() {
  const network = hre.network.name as NetworkName;
  console.log(`\n🔍 Checking v1.5 governance on ${network}...\n`);

  const networkConfig = getNetworkConfig(network);
  const multisigAddress = networkConfig.safeAddress;
  const communityMultisigAddress = process.env.COMMUNITY_MULTISIG_ADDRESS;

  if (!multisigAddress) {
    console.warn(`⚠️  SAFE_ADDRESS_${network.toUpperCase()} is not set. Skipping governance checks.`);
    return;
  }

  const contracts = [
    {
      name: CONTRACT_NAMES.YmtMinter,
      contractName: V1_5_CONTRACTS.YmtMinter,
      governanceFunction: 'governance',
      proxy: true,
      isCommunityAddress: false,
    },
    {
      name: CONTRACT_NAMES.YmtVesting,
      contractName: V1_5_CONTRACTS.YmtVesting,
      governanceFunction: 'contractAdmin',
      proxy: false,
      isCommunityAddress: true,
    },
    {
      name: CONTRACT_NAMES.YMT,
      contractName: V1_5_CONTRACTS.YMT,
      governanceFunction: 'admin',
      proxy: false,
      isCommunityAddress: false,
    },
    {
      name: CONTRACT_NAMES.Yamato,
      contractName: V1_CONTRACTS.Yamato,
      governanceFunction: 'governance',
      proxy: true,
      isCommunityAddress: false,
    },
    {
      name: CONTRACT_NAMES.ScoreRegistry,
      contractName: V1_5_CONTRACTS.ScoreRegistry,
      governanceFunction: 'governance',
      proxy: true,
      isCommunityAddress: false,
    },
    {
      name: CONTRACT_NAMES.ScoreWeightController,
      contractName: V1_5_CONTRACTS.ScoreWeightController,
      governanceFunction: 'governance',
      proxy: true,
      isCommunityAddress: false,
    },
    {
      name: CONTRACT_NAMES.FeePool,
      contractName: V1_CONTRACTS.FeePool,
      governanceFunction: 'governance',
      proxy: true,
      isCommunityAddress: false,
    },
    {
      name: CONTRACT_NAMES.CurrencyOS,
      contractName: V1_CONTRACTS.CurrencyOS,
      governanceFunction: 'governance',
      proxy: true,
      isCommunityAddress: false,
    },
  ];

  console.log('='.repeat(60));
  console.log('🛡️  Checking Governance Addresses');
  console.log('='.repeat(60) + '\n');

  let governanceCheckPassed = 0;
  let governanceCheckFailed = 0;

  for (const { name, contractName, governanceFunction, proxy, isCommunityAddress } of contracts) {
    try {
      const address = proxy 
        ? loadProxyAddress(network, name)
        : loadAddress(network, contractName);
      
      const contractInstance = await hre.viem.getContractAt(contractName, address);
      const governanceAddress = await contractInstance.read[governanceFunction]() as `0x${string}`;
      
      const expectedAddress = isCommunityAddress 
        ? (communityMultisigAddress as `0x${string}`)
        : (multisigAddress as `0x${string}`);
      
      const matches = governanceAddress.toLowerCase() === expectedAddress.toLowerCase();
      
      console.log(`📋 ${name}:`);
      console.log(`   ${governanceFunction}: ${governanceAddress}`);
      if (matches) {
        console.log(`   ✅ Match: ${expectedAddress}`);
        governanceCheckPassed++;
      } else {
        console.log(`   ❌ Expected: ${expectedAddress}`);
        governanceCheckFailed++;
      }
    } catch (error) {
      console.log(`❌ ${name}: Error - ${error instanceof Error ? error.message : error}`);
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

