import hre from 'hardhat';
import { loadProxyAddress, type NetworkName } from '../core/address-manager';
import { getNetworkConfig } from '../../config/networks';
import { V1_CONTRACTS, CONTRACT_NAMES } from '../core/contract-definitions';

/**
 * v1.0 ガバナンス権限をマルチシグに移譲
 * 
 * 全てのUUPSコントラクトの管理権限をマルチシグウォレットに移譲します。
 * この操作後、コントラクトのアップグレードはマルチシグの承認が必要になります。
 * 
 * 環境変数:
 * - sepolia: SAFE_ADDRESS_SEPOLIA
 * - mainnet: SAFE_ADDRESS_MAINNET
 * - localhost: テスト用アドレス（ハードコード）
 */
async function main() {
  const network = hre.network.name as NetworkName;
  const isLocalhost = network === 'localhost';
  console.log(`\n🔐 Transferring governance to multisig on ${network}...\n`);

  // マルチシグアドレスを取得
  const networkConfig = getNetworkConfig(network);
  const multisigAddr = isLocalhost
    ? '0x70997970C51812dc3A010C7d01b50e0d17dc79C8' // Anvilのアカウント#1（テスト用）
    : networkConfig.safeAddress;
  
  if (!multisigAddr) {
    throw new Error(`SAFE_ADDRESS_${network.toUpperCase()} is not set in .env`);
  }
  console.log(`📝 Multisig address: ${multisigAddr}\n`);

  // contract-definitions.tsから定義を取得
  const contracts = [
    { name: CONTRACT_NAMES.PriceFeed, contractName: V1_CONTRACTS.PriceFeed },
    { name: CONTRACT_NAMES.FeePool, contractName: V1_CONTRACTS.FeePool },
    { name: CONTRACT_NAMES.CurrencyOS, contractName: V1_CONTRACTS.CurrencyOS },
    { name: CONTRACT_NAMES.Pool, contractName: V1_CONTRACTS.Pool },
    { name: CONTRACT_NAMES.PriorityRegistry, contractName: V1_CONTRACTS.PriorityRegistry },
    { name: CONTRACT_NAMES.Yamato, contractName: V1_CONTRACTS.Yamato },
    { name: CONTRACT_NAMES.YamatoDepositor, contractName: V1_CONTRACTS.YamatoDepositor },
    { name: CONTRACT_NAMES.YamatoBorrower, contractName: V1_CONTRACTS.YamatoBorrower },
    { name: CONTRACT_NAMES.YamatoRepayer, contractName: V1_CONTRACTS.YamatoRepayer },
    { name: CONTRACT_NAMES.YamatoWithdrawer, contractName: V1_CONTRACTS.YamatoWithdrawer },
    { name: CONTRACT_NAMES.YamatoRedeemer, contractName: V1_CONTRACTS.YamatoRedeemer },
    { name: CONTRACT_NAMES.YamatoSweeper, contractName: V1_CONTRACTS.YamatoSweeper },
  ];

  const publicClient = await hre.viem.getPublicClient();
  let successCount = 0;

  // 各コントラクトに対してsetGovernance()を実行
  for (const { name, contractName } of contracts) {
    try {
      console.log(`🔄 [${successCount + 1}/${contracts.length}] ${name}.setGovernance()...`);
      
      // 共通関数を使用
      const proxyAddress = loadProxyAddress(network, name);
      const contract = await hre.viem.getContractAt(contractName, proxyAddress);
      
      const hash = await contract.write.setGovernance([multisigAddr as `0x${string}`]);
      
      console.log(`   📝 Transaction hash: ${hash}`);
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      console.log(`   ✅ Confirmed in block ${receipt.blockNumber}`);
      
      successCount++;
    } catch (error) {
      console.error(`   ❌ Failed to transfer governance for ${name}:`, error);
      throw error;
    }
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`\n🎉 Governance transfer completed!`);
  console.log(`\n📊 Summary:`);
  console.log(`   Total contracts: ${successCount}/${contracts.length}`);
  console.log(`   Multisig address: ${multisigAddr}`);
  console.log(`\n📝 Next steps:`);
  console.log(`   1. Switch PRIVATE_KEY in .env to multisig signer's key`);
  console.log(`   2. Run: npx hardhat run scripts/governance/v1-accept-governance.ts --network ${network}`);
  console.log(`\n⚠️  Warning: Contract upgrades now require multisig approval!`);
  console.log(`\n${'='.repeat(60)}\n`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
