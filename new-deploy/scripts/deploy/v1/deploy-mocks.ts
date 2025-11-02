import 'dotenv/config';
import { createClients } from '../../core/client.js';
import { deployContract } from '../../core/contract-deployer.js';
import { loadArtifact } from '../../core/artifact-loader.js';
import type { NetworkName } from '../../../config/networks.js';

async function main() {
  const args = process.argv.slice(2);
  const networkArg = args.find((arg) => arg.startsWith('--network='));
  const network = (networkArg?.split('=')[1] || 'localhost') as NetworkName;

  console.log(`\n🌐 Network: ${network}\n`);

  const { publicClient, walletClient } = createClients(network);

  // ChainlinkMock (ETH/USD)のデプロイ
  console.log('🚀 Deploying ChainlinkMock (ETH/USD)...');
  const { abi: ethUsdAbi, bytecode: ethUsdBytecode } = loadArtifact('ChainLinkMock');
  
  const ethUsdAddress = await deployContract({
    name: 'ChainLinkMockEthUsd',
    abi: ethUsdAbi,
    bytecode: ethUsdBytecode,
    args: ['ETH/USD'], // コンストラクタ引数を追加
    walletClient,
    publicClient,
    network,
  });

  console.log(`✅ ChainLinkMock (ETH/USD) deployed at: ${ethUsdAddress}\n`);

  // ChainlinkMock (JPY/USD)のデプロイ
  console.log('🚀 Deploying ChainlinkMock (JPY/USD)...');
  const jpyUsdAddress = await deployContract({
    name: 'ChainLinkMockJpyUsd',
    abi: ethUsdAbi, // 同じABI
    bytecode: ethUsdBytecode, // 同じBytecode
    args: ['JPY/USD'], // コンストラクタ引数を追加
    walletClient,
    publicClient,
    network,
  });

  console.log(`✅ ChainLinkMock (JPY/USD) deployed at: ${jpyUsdAddress}\n`);

  // 価格データの初期化（simulatePriceMove）
  console.log('🔧 Initializing oracle prices...');
  
  // ETH/USD: 2回の価格移動をシミュレート
  for (let i = 0; i < 2; i++) {
    const hash = await walletClient.writeContract({
      address: ethUsdAddress,
      abi: ethUsdAbi,
      functionName: 'simulatePriceMove',
      args: [],
    });
    await publicClient.waitForTransactionReceipt({ hash });
  }
  console.log('✅ ETH/USD prices initialized');
  
  // JPY/USD: 2回の価格移動をシミュレート
  for (let i = 0; i < 2; i++) {
    const hash = await walletClient.writeContract({
      address: jpyUsdAddress,
      abi: ethUsdAbi,
      functionName: 'simulatePriceMove',
      args: [],
    });
    await publicClient.waitForTransactionReceipt({ hash });
  }
  console.log('✅ JPY/USD prices initialized\n');

  console.log(`\n✅ All oracle mocks deployed successfully!\n`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });

