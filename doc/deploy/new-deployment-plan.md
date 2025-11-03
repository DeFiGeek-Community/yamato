# Yamato デプロイスクリプト刷新プラン

## 方針

**既存のコントラクトとパッケージはそのまま使用し、デプロイスクリプトのみをhardhat-viemベースで刷新します。**

- ✅ 既存のコントラクト（Hardhatの`paths`設定で参照）
- ✅ 既存のアドレス管理（`deployments/`ディレクトリ、相対パスで参照）
- 🆕 新規デプロイ: **hardhat-viem**（TypeScript + Hardhat）で実装
- 🆕 アップグレード・Safe操作: **hardhat-viem**（TypeScript + Hardhat）で実装
- 🔒 ライブラリリンク: **hardhat-viemの公式機能**で安全に実装
- 🌍 クロスプラットフォーム: **シンボリックリンク不要**でWindows対応

---

## デプロイ方式の選択

### 新規デプロイ → hardhat-viem (TypeScript)
- UUPSプロキシのデプロイ（hardhat-viemのヘルパー使用）
- ライブラリリンク（`resolveBytecodeWithLinkedLibraries`使用）
- 通常のコントラクトデプロイ
- 初期設定
- **理由**: 
  - TypeScriptで統一、型安全
  - ライブラリリンクが公式サポート（自前実装不要）
  - Hardhat環境との統合が容易
- **注意**: `new-deploy`内に独立したHardhat環境を構築

### アップグレード → hardhat-viem (TypeScript)
- **ローカル**: hardhat-viemで直接実行（確認用）
- **本番**: Safe Transaction作成→マルチシグ承認→実行
- **理由**: デプロイと同じ技術スタックで統一

---

## ディレクトリ構造

```
yamato/                          # 既存プロジェクト
├── contracts/                   # ✅ 既存のまま
│   ├── Yamato.sol
│   ├── YamatoV3.sol
│   ├── YamatoV4.sol
│   ├── ERC1967Proxy.sol
│   └── ...
├── deployments/                 # ✅ 既存のアドレス管理（活用）
│   ├── sepolia/
│   │   ├── .chainId
│   │   ├── YamatoERC1967Proxy
│   │   ├── YamatoUUPSImpl
│   │   └── ...
│   └── mainnet/
├── deploy/                      # 既存（保持）
├── new-deploy/                  # 🆕 新しいデプロイ環境（独立したHardhat環境）
│   ├── hardhat.config.ts        # paths設定で../contractsを参照
│   ├── .env                     # 環境変数
│   ├── .env.example             # 環境変数テンプレート
│   ├── scripts/                 # hardhat-viemデプロイスクリプト
│   │   ├── core/
│   │   │   ├── address-manager.ts    # アドレス管理（../deploymentsを参照）
│   │   │   ├── uups-deployer.ts      # UUPSデプロイヘルパー
│   │   │   └── safe-manager.ts       # Safe操作
│   │   ├── deploy/
│   │   │   ├── v1/
│   │   │   │   ├── deploy-pricefeed.ts
│   │   │   │   ├── deploy-cjpy.ts
│   │   │   │   ├── deploy-feepool.ts
│   │   │   │   ├── deploy-currencyos.ts
│   │   │   │   ├── deploy-yamato.ts
│   │   │   │   ├── deploy-yamato-actions.ts
│   │   │   │   ├── deploy-pool.ts
│   │   │   │   ├── deploy-priority-registry.ts
│   │   │   │   └── setup-dependencies.ts
│   │   │   ├── v1.5/
│   │   │   │   ├── deploy-ymt.ts
│   │   │   │   ├── deploy-ymt-contracts.ts
│   │   │   │   └── setup-ymt.ts
│   │   │   └── v2/
│   │   │       ├── deploy-ymtos.ts
│   │   │       └── deploy-multi-currency.ts
│   │   ├── upgrade/
│   │   │   ├── upgrade-yamato.ts
│   │   │   ├── upgrade-actions.ts
│   │   │   └── upgrade-currencyos.ts
│   │   └── governance/
│   │       └── transfer-governance.ts
│   ├── artifacts/               # new-deploy内に生成
│   ├── cache/                   # new-deploy内に生成
│   ├── package.json             # hardhat-viem環境のpackage.json
│   ├── tsconfig.json            # TypeScript設定
│   └── README.md                # 使い方
└── package.json                 # 既存（保持）
```

---

## アドレス管理

### 既存形式を完全踏襲

```
deployments/sepolia/
├── .chainId                     # "11155111"
├── YamatoERC1967Proxy           # プロキシアドレス
├── YamatoUUPSImpl               # 実装アドレス
├── CJPY                         # 通常のコントラクト
└── ...
```

**hardhat-viemスクリプト**から`path.resolve()`で親ディレクトリの`deployments/`を参照して読み書きします。

```typescript
// new-deploy/scripts/core/address-manager.ts
import { resolve } from 'path';

// 親ディレクトリのdeploymentsを参照
const DEPLOYMENTS_DIR = resolve(__dirname, '../../../deployments');
```

---

## UUPSデプロイの実装（hardhat-viem使用）

hardhat-viemを使用することで、ライブラリリンクを含むUUPSデプロイが安全に実行できます。

### 1. 基本的なUUPSデプロイ

```typescript
// scripts/deploy/v1/deploy-yamato.ts
import hre from 'hardhat';
import { saveAddress, loadAddress } from '../../core/address-manager';

async function main() {
  const network = hre.network.name;
  
  // 依存コントラクトのアドレスを読み込む
  const currencyOSAddress = loadAddress(network, 'CurrencyOSERC1967Proxy');
  
  // YamatoV3のartifactを取得
  const artifact = await hre.artifacts.readArtifact('YamatoV3');
  
  // クライアントを取得
  const publicClient = await hre.viem.getPublicClient();
  const [walletClient] = await hre.viem.getWalletClients();
  
  // 実装コントラクトをデプロイ
  const implHash = await walletClient.deployContract({
    abi: artifact.abi,
    bytecode: artifact.bytecode as `0x${string}`,
    args: [],
  });
  const implReceipt = await publicClient.waitForTransactionReceipt({ hash: implHash });
  const implAddress = implReceipt.contractAddress!;
  
  // 初期化データをエンコード
  const initData = encodeFunctionData({
    abi: artifact.abi,
    functionName: 'initialize',
    args: [currencyOSAddress],
  });
  
  // プロキシをデプロイ
  const proxyArtifact = await hre.artifacts.readArtifact('ERC1967Proxy');
  const proxyHash = await walletClient.deployContract({
    abi: proxyArtifact.abi,
    bytecode: proxyArtifact.bytecode as `0x${string}`,
    args: [implAddress, initData],
  });
  const proxyReceipt = await publicClient.waitForTransactionReceipt({ hash: proxyHash });
  const proxyAddress = proxyReceipt.contractAddress!;
  
  // アドレスを保存
  await saveAddress(network, 'YamatoUUPSImpl', implAddress);
  await saveAddress(network, 'YamatoERC1967Proxy', proxyAddress);
  
  console.log(`Yamato deployed!`);
  console.log(`  Implementation: ${implAddress}`);
  console.log(`  Proxy: ${proxyAddress}`);
}
```

### 2. ライブラリリンク付きUUPSデプロイ

```typescript
// scripts/deploy/v1/deploy-yamato-borrower.ts
import hre from 'hardhat';
import { saveAddress, loadAddress } from '../../core/address-manager';

async function main() {
  const network = hre.network.name;
  
  // 依存アドレスを読み込む
  const yamatoAddress = loadAddress(network, 'YamatoERC1967Proxy');
  const pledgeLibAddress = loadAddress(network, 'PledgeLib');
  
  // YamatoBorrowerのartifactを取得
  const artifact = await hre.artifacts.readArtifact('YamatoBorrower');
  
  // ライブラリリンク済みのbytecodeを取得
  const linkedBytecode = await hre.viem.resolveBytecodeWithLinkedLibraries(
    artifact,
    {
      PledgeLib: pledgeLibAddress,
    }
  );
  
  // クライアントを取得
  const publicClient = await hre.viem.getPublicClient();
  const [walletClient] = await hre.viem.getWalletClients();
  
  // 実装コントラクトをデプロイ（リンク済みbytecode使用）
  const implHash = await walletClient.deployContract({
    abi: artifact.abi,
    bytecode: linkedBytecode,
    args: [],
  });
  const implReceipt = await publicClient.waitForTransactionReceipt({ hash: implHash });
  const implAddress = implReceipt.contractAddress!;
  
  // 初期化データをエンコード
  const initData = encodeFunctionData({
    abi: artifact.abi,
    functionName: 'initialize',
    args: [yamatoAddress],
  });
  
  // プロキシをデプロイ
  const proxyArtifact = await hre.artifacts.readArtifact('ERC1967Proxy');
  const proxyHash = await walletClient.deployContract({
    abi: proxyArtifact.abi,
    bytecode: proxyArtifact.bytecode as `0x${string}`,
    args: [implAddress, initData],
  });
  const proxyReceipt = await publicClient.waitForTransactionReceipt({ hash: proxyHash });
  const proxyAddress = proxyReceipt.contractAddress!;
  
  // アドレスを保存
  await saveAddress(network, 'YamatoBorrowerUUPSImpl', implAddress);
  await saveAddress(network, 'YamatoBorrowerERC1967Proxy', proxyAddress);
  
  console.log(`YamatoBorrower deployed!`);
  console.log(`  Implementation: ${implAddress}`);
  console.log(`  Proxy: ${proxyAddress}`);
}
```

### 3. UUPS Deployerヘルパー（hardhat-viem版）

```typescript
// scripts/core/uups-deployer.ts
import hre from 'hardhat';
import { encodeFunctionData } from 'viem';
import { saveAddress } from './address-manager';

export async function deployUUPS(params: {
  name: string;
  contractName: string;
  initFunction?: string;
  initArgs: any[];
  libraries?: Record<string, `0x${string}`>;
}) {
  const network = hre.network.name;
  
  // Artifactを取得
  const artifact = await hre.artifacts.readArtifact(params.contractName);
  
  // ライブラリリンク（必要な場合）
  let bytecode = artifact.bytecode as `0x${string}`;
  if (params.libraries) {
    bytecode = await hre.viem.resolveBytecodeWithLinkedLibraries(
      artifact,
      params.libraries
    );
  }
  
  // クライアントを取得
  const publicClient = await hre.viem.getPublicClient();
  const [walletClient] = await hre.viem.getWalletClients();
  
  // 実装コントラクトをデプロイ
  const implHash = await walletClient.deployContract({
    abi: artifact.abi,
    bytecode,
    args: [],
  });
  const implReceipt = await publicClient.waitForTransactionReceipt({ hash: implHash });
  const implAddress = implReceipt.contractAddress!;
  
  // 初期化データをエンコード
  const initData = encodeFunctionData({
    abi: artifact.abi,
    functionName: params.initFunction || 'initialize',
    args: params.initArgs,
  });
  
  // プロキシをデプロイ
  const proxyArtifact = await hre.artifacts.readArtifact('ERC1967Proxy');
  const proxyHash = await walletClient.deployContract({
    abi: proxyArtifact.abi,
    bytecode: proxyArtifact.bytecode as `0x${string}`,
    args: [implAddress, initData],
  });
  const proxyReceipt = await publicClient.waitForTransactionReceipt({ hash: proxyHash });
  const proxyAddress = proxyReceipt.contractAddress!;
  
  // アドレスを保存
  await saveAddress(network, `${params.name}UUPSImpl`, implAddress);
  await saveAddress(network, `${params.name}ERC1967Proxy`, proxyAddress);
  
  return { implAddress, proxyAddress };
}

// 使用例1: 通常のUUPSデプロイ
await deployUUPS({
  name: 'Yamato',
  contractName: 'YamatoV3',
  initArgs: [currencyOSAddress],
});

// 使用例2: ライブラリリンク付きUUPSデプロイ
await deployUUPS({
  name: 'YamatoBorrower',
  contractName: 'YamatoBorrower',
  initArgs: [yamatoAddress],
  libraries: {
    PledgeLib: pledgeLibAddress,
  },
});
```


---

## 実装範囲

### Phase 1: viemデプロイスクリプト

**対象**:
- UUPSデプロイヘルパーの実装
- v1.0 全コントラクトのデプロイ
- v1.5 新規コントラクトのデプロイ
- v2 新規コントラクトのデプロイ

**成果物**:
- `new-deploy/scripts/core/uups-deployer.ts`
- `new-deploy/scripts/deploy/` 配下のTypeScriptスクリプト
- アドレスを`deployments/`に保存する仕組み

### Phase 2: アップグレードスクリプト

**対象**:
- v1.5 既存コントラクトのアップグレード
- v2 既存コントラクトのアップグレード
- ガバナンス移行

**成果物**:
- `new-deploy/scripts/upgrade/` 配下のTypeScriptスクリプト
- **ローカル**: viemで直接実行
- **本番**: Safe Transaction作成・実行

---

## コマンド例

### hardhat-viemデプロイ（新規）

```bash
cd new-deploy

# コントラクトをコンパイル（親ディレクトリのcontractsを参照）
npx hardhat compile

# v1.0デプロイ（.envを自動で読み込む）
npx hardhat run scripts/deploy/v1/deploy-yamato.ts --network sepolia

# 特定のコントラクトのみ
npx hardhat run scripts/deploy/v1/deploy-cjpy.ts --network sepolia

# 初期設定
npx hardhat run scripts/deploy/v1/setup-dependencies.ts --network sepolia

# または、tsxで直接実行も可能
npx tsx scripts/deploy/v1/deploy-yamato.ts
```

### アップグレード

```bash
cd new-deploy

# ローカル確認（hardhat-viemで直接実行）
npx hardhat run scripts/upgrade/upgrade-yamato.ts \
  --network localhost

# 本番（Safe Transaction作成）
npx hardhat run scripts/upgrade/upgrade-yamato.ts \
  --network sepolia

# Safe Transaction実行（マルチシグ承認後）
npx hardhat run scripts/upgrade/execute-upgrade.ts \
  --network sepolia
```

---

## メリット

### hardhat-viemを使う理由

1. **TypeScriptで統一**: デプロイもアップグレードも同じ言語・ツールで実装
2. **型安全**: TypeScriptとviemの型チェックが効く
3. **ライブラリリンクが安全**: `resolveBytecodeWithLinkedLibraries`で公式サポート
4. **柔軟性**: 複雑なロジックや条件分岐が書きやすい
5. **環境切り替え**: ローカル/本番の違いを容易に吸収
6. **既存資産活用**: `paths`設定でcontractsとdeploymentsを参照
7. **モダンなツール**: 最新のEthereumライブラリ（viem）とHardhatの統合
8. **デバッグ容易**: TypeScriptのデバッガーが使える
9. **バージョン独立**: 既存のHardhat環境に影響しない
10. **クロスプラットフォーム**: シンボリックリンク不要でWindows/Mac/Linux対応

### デメリットと対策

1. **独立したHardhat環境が必要**
   - 対策: `new-deploy`内に独立した環境を構築
   - `paths`設定で既存のcontractsを参照

2. **コンパイルが必要**
   - 対策: `npx hardhat compile`で親ディレクトリのcontractsをコンパイル
   - artifactsは`new-deploy`内に生成

3. **ガス見積もり**
   - 対策: デプロイ前に`estimateGas()`で確認

---

## 必要な準備

### 1. new-deploy/ の初期化

```bash
mkdir new-deploy
cd new-deploy

# package.json作成
npm init -y

# Hardhat + hardhat-viemをインストール
npm install --save-dev hardhat @nomicfoundation/hardhat-viem viem

# その他の必要なパッケージ
npm install --save-dev typescript tsx @types/node dotenv

# .env.exampleを作成
cat > .env.example << EOF
# RPC URLs
SEPOLIA_RPC_URL=
MAINNET_RPC_URL=
LOCALHOST_RPC_URL=http://127.0.0.1:8545

# Private Keys
PRIVATE_KEY=

# Etherscan API Key (verify用)
ETHERSCAN_API_KEY=

# Safe Address (本番環境)
SAFE_ADDRESS_SEPOLIA=
SAFE_ADDRESS_MAINNET=

# Chain IDs
SEPOLIA_CHAIN_ID=11155111
MAINNET_CHAIN_ID=1
LOCALHOST_CHAIN_ID=31337
EOF

# .envをコピー
cp .env.example .env
# → .envを編集して実際の値を設定

# hardhat.config.ts作成
cat > hardhat.config.ts << 'EOF'
import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-viem";
import "dotenv/config";
import path from "path";

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.4",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    localhost: {
      url: process.env.LOCALHOST_RPC_URL || "http://127.0.0.1:8545",
      chainId: parseInt(process.env.LOCALHOST_CHAIN_ID || "31337"),
    },
    sepolia: {
      url: process.env.SEPOLIA_RPC_URL || "",
      chainId: 11155111,
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
    },
    mainnet: {
      url: process.env.MAINNET_RPC_URL || "",
      chainId: 1,
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
    },
  },
  paths: {
    sources: path.resolve(__dirname, "../contracts"),  // 親のcontractsを参照
    artifacts: "./artifacts",                          // new-deploy内に生成
    cache: "./cache",                                  // new-deploy内に生成
  },
};

export default config;
EOF

# tsconfig.json作成
cat > tsconfig.json << EOF
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "./dist",
    "rootDir": "./",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true
  },
  "include": ["scripts/**/*", "hardhat.config.ts"],
  "exclude": ["node_modules", "dist", "artifacts", "cache"]
}
EOF
```

### 2. コントラクトのコンパイル

```bash
# new-deploy内でコンパイル（paths設定で親のcontractsを参照）
cd new-deploy
npx hardhat compile
```

---

## 実装手順

### Week 1: 環境構築とUUPSデプロイヘルパー
- [ ] `new-deploy/`ディレクトリ作成
- [ ] `new-deploy/`内でHardhat + hardhat-viem環境を初期化
- [ ] `hardhat.config.ts`の`paths`設定で親の`contracts/`を参照
- [ ] `.env`、`hardhat.config.ts`、`tsconfig.json`作成
- [ ] アドレス管理ユーティリティ実装（`address-manager.ts`）
  - [ ] `resolve(__dirname, '../../../deployments')`で親の`deployments/`を参照
- [ ] **UUPSデプロイヘルパー実装（`uups-deployer.ts`）**
  - [ ] hardhat-viemの`resolveBytecodeWithLinkedLibraries`を活用
  - [ ] 実装コントラクトのデプロイ
  - [ ] プロキシコントラクトのデプロイ
  - [ ] 初期化データのエンコード
  - [ ] アドレスの保存

### Week 2-3: hardhat-viemデプロイスクリプト実装
- [ ] v1.0デプロイスクリプト
  - [ ] PriceFeed（UUPS）
  - [ ] CJPY（通常）
  - [ ] FeePool（UUPS）
  - [ ] CurrencyOS（UUPS）
  - [ ] Yamato（UUPS）
  - [ ] PledgeLib（ライブラリ）
  - [ ] YamatoActions（UUPS×6、ライブラリリンク付き）
  - [ ] Pool（UUPS、ライブラリリンク付き）
  - [ ] PriorityRegistry（UUPS、ライブラリリンク付き）
  - [ ] 初期設定スクリプト
- [ ] ローカルでの動作確認

### Week 4: v1.5/v2デプロイスクリプト実装
- [ ] v1.5デプロイスクリプト
- [ ] v2デプロイスクリプト
- [ ] アップグレードスクリプト
- [ ] Safe Transaction作成機能

### Week 5: 検証
- [ ] ローカル環境での確認
- [ ] Sepoliaでの検証
- [ ] ドキュメント作成

---

## 制約事項

### hardhat-viemで対応できないもの

1. **Etherscan Verify**: 別ツール使用（hardhat-verify等）

### hardhat-viemで対応できるもの

1. **コントラクトのコンパイル**: Hardhat内蔵
2. **新規デプロイ**: 全て対応可能（UUPSもライブラリリンクも対応）
3. **初期設定**: setAddrs等
4. **アドレス管理**: `deployments/`へ読み書き
5. **アップグレード**: 直接実行またはSafe Transaction作成

### ローカル vs 本番

| 操作 | ローカル | 本番 |
|------|---------|------|
| コンパイル | Hardhat | Hardhat |
| 新規デプロイ | hardhat-viem直接実行 | hardhat-viem直接実行 |
| アップグレード | hardhat-viem直接実行 | Safe Transaction |
| 初期設定 | hardhat-viem直接実行 | hardhat-viem/Safe |

---

## トラブルシューティング

### Q: UUPSプロキシのデプロイ方法は？
A: hardhat-viemを使用して以下の手順で実装：
1. `hre.artifacts.readArtifact()`でartifactを取得
2. ライブラリリンクが必要な場合は`hre.viem.resolveBytecodeWithLinkedLibraries()`を使用
3. 実装コントラクトをデプロイ
4. `encodeFunctionData`で初期化データを作成
5. ERC1967Proxyをデプロイ（実装アドレス + 初期化データ）
6. 両方のアドレスを保存

**初期化関数名について**:
- デフォルトは`'initialize'`
- `initFunction`パラメータで変更可能（例: `'__CurrencyOS_init'`, `'setUp'`）
- 各コントラクトのABIを確認して必要に応じて指定

### Q: ライブラリリンクはどうする？
A: hardhat-viemの`resolveBytecodeWithLinkedLibraries()`を使用：
```typescript
const linkedBytecode = await hre.viem.resolveBytecodeWithLinkedLibraries(
  artifact,
  {
    PledgeLib: pledgeLibAddress,
  }
);
```

### Q: アドレスファイルの読み書きは？
A: Node.jsの`fs`モジュールを使用。既存形式で保存。`path.resolve()`で親の`deployments/`を参照して保存。

### Q: 既存のdeploymentsディレクトリとの互換性は？
A: 完全に互換性あり。`path.resolve()`で既存の`deployments/`を参照し、同じファイル名・形式で読み書き。

### Q: ABI/Bytecodeはどこから取得？
A: hardhat-viemの`hre.artifacts.readArtifact()`で取得。`paths`設定で親の`contracts/`を参照してコンパイルしたartifactsを使用。

### Q: 既存のHardhat環境に影響は？
A: 影響なし。`new-deploy`内に独立したHardhat環境を構築し、`paths`設定で必要なファイルのみ参照。

---

## 次のステップ

実装を開始する準備が整いました：

1. **`new-deploy/`ディレクトリ作成と初期化**
   ```bash
   mkdir new-deploy
   cd new-deploy
   npm init -y
   npm install --save-dev hardhat @nomicfoundation/hardhat-viem viem
   npm install --save-dev typescript tsx @types/node dotenv
   
   # シンボリックリンク作成
   ln -s ../contracts contracts
   ln -s ../deployments deployments
   ```

2. **Hardhat環境設定**
   - `hardhat.config.ts`作成
   - `.env.example`作成
   - `.env`作成して実際の値を設定
   - `tsconfig.json`作成

3. **コントラクトのコンパイル**
   ```bash
   npx hardhat compile
   ```

4. **UUPSデプロイヘルパー実装**
   - `scripts/core/uups-deployer.ts`（hardhat-viem使用）
   - `scripts/core/address-manager.ts`

5. **hardhat-viemデプロイスクリプト作成**
   - v1.0デプロイスクリプト
   - 初期設定スクリプト

準備完了！実装を開始しましょう。
