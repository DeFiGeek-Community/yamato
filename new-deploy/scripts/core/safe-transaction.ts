import Safe from '@safe-global/protocol-kit';
import SafeApiKit from '@safe-global/api-kit';
import { SafeTransactionDataPartial } from '@safe-global/safe-core-sdk-types';
import { encodeFunctionData, type Abi, type Address } from 'viem';

interface SafeConfig {
  chainId: bigint;
  rpcUrl: string;
  signerPrivateKey: string;
  safeAddress: string;
}

// ネットワークごとの設定
const NETWORK_CONFIG = {
  sepolia: {
    chainId: BigInt('11155111'),
    rpcUrl: process.env.SEPOLIA_RPC_URL || process.env.ALCHEMY_URL || '',
  },
  mainnet: {
    chainId: BigInt('1'),
    rpcUrl: process.env.MAINNET_RPC_URL || process.env.ALCHEMY_URL || '',
  },
};

/**
 * Safe Transactionを作成して提案
 * 
 * @param contractAddress コントラクトアドレス
 * @param abi コントラクトABI
 * @param functionName 関数名
 * @param args 関数引数
 * @param network ネットワーク名
 */
export async function createAndProposeSafeTransaction(
  contractAddress: Address,
  abi: Abi,
  functionName: string,
  args: any[],
  network: string
): Promise<void> {
  console.log(`\n📝 Creating Safe Transaction for ${functionName}()...`);

  // ネットワーク設定を取得
  const networkConfig = NETWORK_CONFIG[network as keyof typeof NETWORK_CONFIG];
  if (!networkConfig) {
    throw new Error(`Unsupported network: ${network}`);
  }

  // Safe設定を取得
  const config: SafeConfig = {
    chainId: networkConfig.chainId,
    rpcUrl: networkConfig.rpcUrl,
    signerPrivateKey: process.env.SIGNER_ADDRESS_PRIVATE_KEY || process.env.PRIVATE_KEY || '',
    safeAddress: process.env.UUPS_PROXY_ADMIN_MULTISIG_ADDRESS || '',
  };

  if (!config.signerPrivateKey) {
    throw new Error('SIGNER_ADDRESS_PRIVATE_KEY or PRIVATE_KEY is not set in .env');
  }
  if (!config.safeAddress) {
    throw new Error('UUPS_PROXY_ADMIN_MULTISIG_ADDRESS is not set in .env');
  }

  // Protocol Kitを初期化
  const protocolKit = await Safe.init({
    provider: config.rpcUrl,
    signer: config.signerPrivateKey,
    safeAddress: config.safeAddress,
  });

  // API Kitを初期化
  const apiKit = new SafeApiKit({
    chainId: config.chainId,
  });

  // 関数呼び出しのデータをエンコード
  const data = encodeFunctionData({
    abi,
    functionName,
    args,
  });

  // Safe Transactionデータを作成
  const safeTransactionData: SafeTransactionDataPartial = {
    to: contractAddress,
    value: '0',
    data: data as `0x${string}`,
  };

  // 次のnonceを取得
  const nextNonce = await apiKit.getNextNonce(config.safeAddress);

  // Safe Transactionを作成
  const safeTransaction = await protocolKit.createTransaction({
    transactions: [safeTransactionData],
    options: { nonce: nextNonce },
  });

  // 署名者のアドレスを取得
  const signerAddress = (await protocolKit.getSafeProvider().getSignerAddress()) || '0x';

  // Transaction hashを取得
  const safeTxHash = await protocolKit.getTransactionHash(safeTransaction);

  // Transaction hashに署名
  const signature = await protocolKit.signHash(safeTxHash);

  // Safe APIにトランザクションを提案
  await apiKit.proposeTransaction({
    safeAddress: config.safeAddress,
    safeTransactionData: safeTransaction.data,
    safeTxHash,
    senderAddress: signerAddress,
    senderSignature: signature.data,
  });

  console.log(`✅ Safe Transaction proposed!`);
  console.log(`   Safe Address: ${config.safeAddress}`);
  console.log(`   Safe Tx Hash: ${safeTxHash}`);
  console.log(`   Signer: ${signerAddress}`);
  console.log(`   Network: ${network}`);
  console.log(`   Chain ID: ${config.chainId.toString()}`);
  console.log(`\n⚠️  This transaction requires multisig approval before execution.`);
}

