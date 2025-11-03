import hre from 'hardhat';
import { loadAddress, type NetworkName } from '../../core/address-manager';

async function main() {
  const network = hre.network.name as NetworkName;
  console.log(`\n🔧 Setting up Yamato dependencies on ${network}...\n`);

  // 全てのアドレスを読み込む
  console.log('📖 Loading contract addresses...');
  const yamatoAddress = loadAddress(network, 'YamatoERC1967Proxy');
  const depositorAddress = loadAddress(network, 'YamatoDepositorERC1967Proxy');
  const borrowerAddress = loadAddress(network, 'YamatoBorrowerERC1967Proxy');
  const repayerAddress = loadAddress(network, 'YamatoRepayerERC1967Proxy');
  const withdrawerAddress = loadAddress(network, 'YamatoWithdrawerERC1967Proxy');
  const redeemerAddress = loadAddress(network, 'YamatoRedeemerERC1967Proxy');
  const sweeperAddress = loadAddress(network, 'YamatoSweeperERC1967Proxy');
  const poolAddress = loadAddress(network, 'PoolERC1967Proxy');
  const priorityRegistryAddress = loadAddress(network, 'PriorityRegistryERC1967Proxy');
  console.log('✅ All addresses loaded\n');

  // Yamatoコントラクトを取得
  const yamato = await hre.viem.getContractAt('YamatoV3', yamatoAddress);

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

