import hre from 'hardhat';
import { loadAddress, type NetworkName } from '../core/address-manager';
import { V1_CONTRACTS } from '../core/contract-definitions';

/**
 * v1.0 ガバナンス権限を受け入れ
 * 
 * マルチシグウォレットから全てのUUPSコントラクトのガバナンス権限を受け入れます。
 * この操作は、transferGovernance実行後にマルチシグの秘密鍵で実行する必要があります。
 */
async function main() {
  const network = hre.network.name as NetworkName;
  console.log(`\n🔐 Accepting governance from multisig on ${network}...\n`);

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

  // 各コントラクトに対してacceptGovernance()を実行
  for (const { name, contractName } of contracts) {
    try {
      console.log(`🔄 [${successCount + 1}/${contracts.length}] ${name}.acceptGovernance()...`);
      
      const proxyAddress = loadAddress(network, `${name}ERC1967Proxy`);
      const contract = await hre.viem.getContractAt(contractName, proxyAddress);
      
      const hash = await contract.write.acceptGovernance();
      
      console.log(`   📝 Transaction hash: ${hash}`);
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      console.log(`   ✅ Confirmed in block ${receipt.blockNumber}`);
      
      successCount++;
    } catch (error) {
      console.error(`   ❌ Failed to accept governance for ${name}:`, error);
      throw error;
    }
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`\n🎉 Governance acceptance completed!`);
  console.log(`\n📊 Summary:`);
  console.log(`   Total contracts: ${successCount}/${contracts.length}`);
  console.log(`   Multisig address: ${multisigAddr}`);
  console.log(`\n✅ All contracts are now under multisig governance!`);
  console.log(`\n⚠️  Important: All future upgrades require multisig approval`);
  console.log(`\n${'='.repeat(60)}\n`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
