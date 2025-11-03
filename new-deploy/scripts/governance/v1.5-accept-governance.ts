import hre from 'hardhat';
import { createWalletClient, http, type WalletClient } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { loadProxyAddress, type NetworkName } from '../core/address-manager';
import { getNetworkConfig } from '../../config/networks';
import { V1_5_CONTRACTS, CONTRACT_NAMES } from '../core/contract-definitions';

/**
 * v1.5 ガバナンス権限を受け入れ
 * 
 * マルチシグウォレットからYMT関連コントラクトのガバナンス権限を受け入れます。
 * この操作は、transferGovernance実行後にマルチシグ署名者の秘密鍵で実行する必要があります。
 * 
 * 実行方法:
 * - localhost: PRIVATE_KEYを使用（テスト用）
 * - その他（sepolia, mainnet）: SIGNER_ADDRESS_PRIVATE_KEYを使用（本番用）
 * 
 * 環境変数:
 * - localhost: PRIVATE_KEY（デプロイ用の秘密鍵）
 * - sepolia/mainnet: SIGNER_ADDRESS_PRIVATE_KEY（マルチシグ署名者の秘密鍵）
 * 
 * 注意: YMTとYmtVestingはacceptGovernanceを持たないため、対象外です。
 * 
 * 対象:
 * - YmtMinter.acceptGovernance()
 * - ScoreWeightController.acceptGovernance()
 * - ScoreRegistry.acceptGovernance()
 */
async function main() {
  const network = hre.network.name as NetworkName;
  const isLocalhost = network === 'localhost';
  console.log(`\n🔐 Accepting v1.5 governance from multisig on ${network}...\n`);

  // マルチシグアドレスを取得（localhostの場合は使用しないが、チェック用に取得）
  const networkConfig = getNetworkConfig(network);
  const multisigAddr = isLocalhost 
    ? '0x70997970C51812dc3A010C7d01b50e0d17dc79C8' // ローカルテスト用
    : networkConfig.safeAddress;
  
  if (!multisigAddr) {
    throw new Error(`SAFE_ADDRESS_${network.toUpperCase()} is not set in .env`);
  }
  console.log(`📝 Multisig address: ${multisigAddr}\n`);

  let customWalletClient: WalletClient;
  
  if (isLocalhost) {
    // ローカル環境: PRIVATE_KEYを使用（hre.viem.getWalletClients()から取得）
    const [walletClient] = await hre.viem.getWalletClients();
    customWalletClient = walletClient;
    console.log(`👤 Signer address: ${walletClient.account.address}\n`);
  } else {
    // 本番環境: SIGNER_ADDRESS_PRIVATE_KEYのみを使用
    const signerPrivateKey = process.env.SIGNER_ADDRESS_PRIVATE_KEY;
    if (!signerPrivateKey) {
      throw new Error('SIGNER_ADDRESS_PRIVATE_KEY is not set in .env (required for production)');
    }
    
    // カスタムwalletClientを作成（マルチシグ署名者の秘密鍵を使用）
    const networkConfig = getNetworkConfig(network);
    const account = privateKeyToAccount(signerPrivateKey as `0x${string}`);
    customWalletClient = createWalletClient({
      account,
      chain: networkConfig.chain,
      transport: http(networkConfig.rpcUrl),
    }) as WalletClient;
    
    console.log(`👤 Signer address: ${account.address}\n`);
  }

  // contract-definitions.tsから定義を取得
  const contracts = [
    { name: CONTRACT_NAMES.YmtMinter, contractName: V1_5_CONTRACTS.YmtMinter },
    { name: CONTRACT_NAMES.ScoreWeightController, contractName: V1_5_CONTRACTS.ScoreWeightController },
    { name: CONTRACT_NAMES.ScoreRegistry, contractName: V1_5_CONTRACTS.ScoreRegistry },
  ];

  const publicClient = await hre.viem.getPublicClient();
  let successCount = 0;

  // 各コントラクトに対してacceptGovernance()を実行
  for (const { name, contractName } of contracts) {
    try {
      console.log(`🔄 [${successCount + 1}/${contracts.length}] ${name}.acceptGovernance()...`);
      
      // 共通関数を使用
      const proxyAddress = loadProxyAddress(network, name);
      const contract = await hre.viem.getContractAt(contractName, proxyAddress);
      
      // カスタムwalletClientを使用してトランザクションを送信
      const hash = await customWalletClient.writeContract({
        address: proxyAddress,
        abi: contract.abi,
        functionName: 'acceptGovernance',
      });
      
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
  console.log(`\n🎉 v1.5 Governance acceptance completed!`);
  console.log(`\n📊 Summary:`);
  console.log(`   Total contracts: ${successCount}/${contracts.length}`);
  console.log(`   Multisig address: ${multisigAddr}`);
  console.log(`\n✅ All v1.5 contracts are now under multisig governance!`);
  console.log(`\n⚠️  Important: All future upgrades require multisig approval`);
  console.log(`\n${'='.repeat(60)}\n`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
