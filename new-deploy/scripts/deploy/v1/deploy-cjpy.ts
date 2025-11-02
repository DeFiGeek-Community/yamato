import 'dotenv/config';
import { createClients } from '../../core/client.js';
import { deployContract } from '../../core/contract-deployer.js';
import { loadArtifact } from '../../core/artifact-loader.js';
import type { NetworkName } from '../../../config/networks.js';

async function main() {
  // ネットワークの指定
  const args = process.argv.slice(2);
  const networkArg = args.find((arg) => arg.startsWith('--network='));
  const network = (networkArg?.split('=')[1] || 'localhost') as NetworkName;

  console.log(`\n🌐 Network: ${network}\n`);

  // Clientsの作成
  const { publicClient, walletClient } = createClients(network);

  // CJPYのABI/Bytecodeを読み込む
  const { abi, bytecode } = loadArtifact('CJPY');

  // CJPYをデプロイ
  const address = await deployContract({
    name: 'CJPY',
    abi,
    bytecode,
    args: [], // CJPYはコンストラクタ引数なし
    walletClient,
    publicClient,
    network,
  });

  console.log(`\n✅ CJPY deployed at: ${address}\n`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });

