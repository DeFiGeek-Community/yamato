import hre from 'hardhat';
import { loadProxyAddress, type NetworkName } from '../core/address-manager';
import { V1_CONTRACTS } from '../core/contract-definitions';

/**
 * v1.0 ガバナンス権限をマルチシグに移譲
 * 
 * 全てのUUPSコントラクトの管理権限をマルチシグウォレットに移譲します。
 * この操作後、コントラクトのアップグレードはマルチシグの承認が必要になります。
 */
async function main() {
  const network = hre.network.name as NetworkName;
  console.log(`\n🔐 Transferring governance to multisig on ${network}...\n`);

  // マルチシグアドレスを環境変数から取得
  const multisigAddr = process.env.UUPS_PROXY_ADMIN_MULTISIG_ADDRESS;
  if (!multisigAddr) {
    throw new Error('UUPS_PROXY_ADMIN_MULTISIG_ADDRESS is not set in .env');
  }
  console.log(`📝 Multisig address: ${multisigAddr}\n`);

  // contract-definitions.tsから定義を取得
  const contracts = [
    { name: 'PriceFeed', contractName: V1_CONTRACTS.PriceFeed },
    { name: 'FeePool', contractName: V1_CONTRACTS.FeePool },
    { name: 'CurrencyOS', contractName: V1_CONTRACTS.CurrencyOS },
    { name: 'Pool', contractName: V1_CONTRACTS.Pool },
    { name: 'PriorityRegistry', contractName: V1_CONTRACTS.PriorityRegistry },
    { name: 'Yamato', contractName: V1_CONTRACTS.Yamato },
    { name: 'YamatoDepositor', contractName: V1_CONTRACTS.YamatoDepositor },
    { name: 'YamatoBorrower', contractName: V1_CONTRACTS.YamatoBorrower },
    { name: 'YamatoRepayer', contractName: V1_CONTRACTS.YamatoRepayer },
    { name: 'YamatoWithdrawer', contractName: V1_CONTRACTS.YamatoWithdrawer },
    { name: 'YamatoRedeemer', contractName: V1_CONTRACTS.YamatoRedeemer },
    { name: 'YamatoSweeper', contractName: V1_CONTRACTS.YamatoSweeper },
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
