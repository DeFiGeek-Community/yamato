import hre from 'hardhat';
import { deployContract } from '../../core/contract-deployer-hh';
import { hasAddress, loadAddress, type NetworkName } from '../../core/address-manager';
import { V1_CONTRACTS } from '../../core/contract-definitions';

async function main() {
  const network = hre.network.name as NetworkName;
  console.log(`\n🌐 Network: ${network}\n`);

  // ChainlinkMock (ETH/USD)のデプロイ
  const ethUsdResult = await deployContract({
    name: 'ChainLinkMockEthUsd',
    contractName: V1_CONTRACTS.ChainLinkMock,
    args: ['ETH/USD'],
  });

  // ChainlinkMock (JPY/USD)のデプロイ
  const jpyUsdResult = await deployContract({
    name: 'ChainLinkMockJpyUsd',
    contractName: V1_CONTRACTS.ChainLinkMock,
    args: ['JPY/USD'],
  });

  // ChainlinkMock (EUR/USD)のデプロイ（CEUR用、既に存在する場合はスキップ）
  let eurUsdResult;
  if (!hasAddress(network, 'ChainLinkMockEurUsd')) {
    eurUsdResult = await deployContract({
      name: 'ChainLinkMockEurUsd',
      contractName: V1_CONTRACTS.ChainLinkMock,
      args: ['EUR/USD'],
    });
    console.log(`✅ ChainLinkMock (EUR/USD) deployed: ${eurUsdResult.address}`);
  } else {
    const eurUsdAddress = loadAddress(network, 'ChainLinkMockEurUsd');
    console.log(`⏭️  ChainLinkMock (EUR/USD) already exists: ${eurUsdAddress}`);
    eurUsdResult = { address: eurUsdAddress };
  }

  // 価格データの初期化（simulatePriceMove）
  console.log('🔧 Initializing oracle prices...');
  
  const publicClient = await hre.viem.getPublicClient();
  const [walletClient] = await hre.viem.getWalletClients();
  const artifact = await hre.artifacts.readArtifact('ChainLinkMock');
  
  // ETH/USD: 2回の価格移動をシミュレート
  for (let i = 0; i < 2; i++) {
    const hash = await walletClient.writeContract({
      address: ethUsdResult.address,
      abi: artifact.abi,
      functionName: 'simulatePriceMove',
      args: [],
    });
    await publicClient.waitForTransactionReceipt({ hash });
  }
  console.log('✅ ETH/USD prices initialized');
  
  // JPY/USD: 2回の価格移動をシミュレート
  for (let i = 0; i < 2; i++) {
    const hash = await walletClient.writeContract({
      address: jpyUsdResult.address,
      abi: artifact.abi,
      functionName: 'simulatePriceMove',
      args: [],
    });
    await publicClient.waitForTransactionReceipt({ hash });
  }
  console.log('✅ JPY/USD prices initialized');
  
  // EUR/USD: 2回の価格移動をシミュレート
  for (let i = 0; i < 2; i++) {
    const hash = await walletClient.writeContract({
      address: eurUsdResult.address,
      abi: artifact.abi,
      functionName: 'simulatePriceMove',
      args: [],
    });
    await publicClient.waitForTransactionReceipt({ hash });
  }
  console.log('✅ EUR/USD prices initialized\n');

  console.log(`\n✅ All oracle mocks deployed successfully!\n`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });

