import hre from 'hardhat';
import { loadProxyAddress, type NetworkName } from '../../core/address-manager';
import { V1_CONTRACTS } from '../../core/contract-definitions';

async function main() {
  const network = hre.network.name as NetworkName;
  console.log(`\n🔧 Setting up Yamato dependencies on ${network}...\n`);

  // 全てのアドレスを読み込む
  console.log('📖 Loading contract addresses...');
  const yamatoAddress = loadProxyAddress(network, 'Yamato');
  const depositorAddress = loadProxyAddress(network, 'YamatoDepositor');
  const borrowerAddress = loadProxyAddress(network, 'YamatoBorrower');
  const repayerAddress = loadProxyAddress(network, 'YamatoRepayer');
  const withdrawerAddress = loadProxyAddress(network, 'YamatoWithdrawer');
  const redeemerAddress = loadProxyAddress(network, 'YamatoRedeemer');
  const sweeperAddress = loadProxyAddress(network, 'YamatoSweeper');
  const poolAddress = loadProxyAddress(network, 'Pool');
  const priorityRegistryAddress = loadProxyAddress(network, 'PriorityRegistry');
  console.log('✅ All addresses loaded\n');

  // Yamatoコントラクトを取得
  const yamato = await hre.viem.getContractAt(V1_CONTRACTS.Yamato, yamatoAddress);

  // Yamato.setDeps()を実行
  console.log('🚀 Executing Yamato.setDeps()...');
  const hash = await yamato.write.setDeps([
    depositorAddress,
    borrowerAddress,
    repayerAddress,
    withdrawerAddress,
    redeemerAddress,
    sweeperAddress,
    poolAddress,
    priorityRegistryAddress,
  ]);

  console.log(`  📝 Transaction hash: ${hash}`);
  const publicClient = await hre.viem.getPublicClient();
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  console.log(`  ✅ Transaction confirmed in block ${receipt.blockNumber}`);

  console.log(`\n✅ Yamato.setDeps() completed successfully!\n`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
