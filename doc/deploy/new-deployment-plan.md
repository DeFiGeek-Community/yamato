# Yamato デプロイスクリプト刷新プラン

## 方針

**既存のコントラクトとパッケージはそのまま使用し、デプロイスクリプトのみをviemベースで刷新します。**

- ✅ 既存のコントラクト（そのまま使用、コピーしない）
- ✅ 既存のアドレス管理（`deployments/`ディレクトリ）そのまま活用
- 🆕 新規デプロイ: **viem**（TypeScript）で実装
- 🆕 アップグレード・Safe操作: **viem**（TypeScript）で実装

---

## デプロイ方式の選択

### 新規デプロイ → viem (TypeScript)
- UUPSプロキシのデプロイ（自前実装）
- 通常のコントラクトデプロイ
- 初期設定
- **理由**: TypeScriptで統一、柔軟性が高い
- **注意**: viemにはUUPSデプロイライブラリがないため、自分で実装が必要

### アップグレード → viem (TypeScript)
- **ローカル**: viemで直接実行（確認用）
- **本番**: Safe Transaction作成→マルチシグ承認→実行
- **理由**: デプロイと同じ技術スタックで統一

---

## ディレクトリ構造

```
yamato/                          # 既存プロジェクト
├── contracts/                   # ✅ 既存のまま（参照のみ）
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
├── new-deploy/                  # 🆕 新しいデプロイスクリプト（全てここで完結）
│   ├── .env                     # 環境変数（このディレクトリ内で管理）
│   ├── .env.example             # 環境変数テンプレート
│   ├── scripts/                 # viemデプロイ・操作スクリプト
│   │   ├── core/
│   │   │   ├── address-manager.ts    # アドレス管理
│   │   │   ├── uups-deployer.ts      # UUPSデプロイヘルパー
│   │   │   ├── contract-deployer.ts  # 通常のコントラクトデプロイ
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
│   ├── config/
│   │   └── networks.ts          # ネットワーク設定
│   ├── package.json             # new-deploy専用のpackage.json
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

**viemスクリプト**から読み書き可能にします。

---

## UUPSデプロイの実装

viemにはUUPSデプロイライブラリがないため、以下の手順を自前で実装する必要があります：

### 1. 実装コントラクトのデプロイ

```typescript
// 実装コントラクトをデプロイ
const implHash = await walletClient.deployContract({
  abi: YamatoABI,
  bytecode: YamatoBytecode,
  args: [],
});
const implReceipt = await publicClient.waitForTransactionReceipt({ hash: implHash });
const implAddress = implReceipt.contractAddress;

// アドレスを保存
await saveAddress(network, 'YamatoUUPSImpl', implAddress);
```

### 2. プロキシコントラクトのデプロイと初期化

```typescript
// 初期化データをエンコード
const initData = encodeFunctionData({
  abi: YamatoABI,
  functionName: 'initialize',
  args: [arg1, arg2, ...],
});

// ERC1967Proxyをデプロイ
const proxyHash = await walletClient.deployContract({
  abi: ERC1967ProxyABI,
  bytecode: ERC1967ProxyBytecode,
  args: [implAddress, initData],
});
const proxyReceipt = await publicClient.waitForTransactionReceipt({ hash: proxyHash });
const proxyAddress = proxyReceipt.contractAddress;

// アドレスを保存
await saveAddress(network, 'YamatoERC1967Proxy', proxyAddress);
```

### 3. UUPS Deployerヘルパー

```typescript
// scripts/core/uups-deployer.ts
export async function deployUUPS(params: {
  name: string;
  implementation: {
    abi: any;
    bytecode: `0x${string}`;
    args?: any[];
  };
  proxy: {
    initFunction?: string;     // デフォルト: 'initialize'
    initArgs: any[];
  };
  walletClient: WalletClient;
  publicClient: PublicClient;
  network: string;
}) {
  // 1. 実装コントラクトのデプロイ
  const implHash = await walletClient.deployContract({
    abi: params.implementation.abi,
    bytecode: params.implementation.bytecode,
    args: params.implementation.args || [],
  });
  const implReceipt = await publicClient.waitForTransactionReceipt({ hash: implHash });
  const implAddress = implReceipt.contractAddress;
  
  // 2. 初期化データのエンコード
  const initData = encodeFunctionData({
    abi: params.implementation.abi,
    functionName: params.proxy.initFunction || 'initialize',  // デフォルトは 'initialize'
    args: params.proxy.initArgs,
  });
  
  // 3. プロキシコントラクトのデプロイ
  const proxyHash = await walletClient.deployContract({
    abi: ERC1967ProxyABI,
    bytecode: ERC1967ProxyBytecode,
    args: [implAddress, initData],
  });
  const proxyReceipt = await publicClient.waitForTransactionReceipt({ hash: proxyHash });
  const proxyAddress = proxyReceipt.contractAddress;
  
  // 4. アドレスの保存
  await saveAddress(network, `${params.name}UUPSImpl`, implAddress);
  await saveAddress(network, `${params.name}ERC1967Proxy`, proxyAddress);
  
  // 5. 結果を返す
  return { implAddress, proxyAddress };
}

// 使用例1: デフォルトの 'initialize' を使用
await deployUUPS({
  name: 'Yamato',
  implementation: {
    abi: YamatoABI,
    bytecode: YamatoBytecode,
  },
  proxy: {
    initArgs: [priceFeedAddress, currencyAddress],
  },
  walletClient,
  publicClient,
  network: 'sepolia',
});

// 使用例2: カスタム初期化関数名を指定
await deployUUPS({
  name: 'CurrencyOS',
  implementation: {
    abi: CurrencyOSABI,
    bytecode: CurrencyOSBytecode,
  },
  proxy: {
    initFunction: '__CurrencyOS_init',  // カスタム関数名
    initArgs: [yamatoAddress],
  },
  walletClient,
  publicClient,
  network: 'sepolia',
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

### viemデプロイ（新規）

```bash
cd new-deploy

# v1.0デプロイ（.envを自動で読み込む）
npx tsx scripts/deploy/v1/deploy-yamato.ts --network sepolia

# 特定のコントラクトのみ
npx tsx scripts/deploy/v1/deploy-cjpy.ts --network sepolia

# 初期設定
npx tsx scripts/deploy/v1/setup-dependencies.ts --network sepolia
```

### アップグレード

```bash
cd new-deploy

# ローカル確認（viemで直接実行）
npx tsx scripts/upgrade/upgrade-yamato.ts \
  --network localhost \
  --version v1.5

# 本番（Safe Transaction作成）
npx tsx scripts/upgrade/upgrade-yamato.ts \
  --network sepolia \
  --version v1.5 \
  --use-safe

# Safe Transaction実行（マルチシグ承認後）
npx tsx scripts/upgrade/execute-upgrade.ts \
  --network sepolia \
  --tx-hash 0x...
```

---

## メリット

### viemを使う理由

1. **TypeScriptで統一**: デプロイもアップグレードも同じ言語・ツールで実装
2. **型安全**: TypeScriptの型チェックが効く
3. **柔軟性**: 複雑なロジックや条件分岐が書きやすい
4. **環境切り替え**: ローカル/本番の違いを容易に吸収
5. **既存資産活用**: 既存のcontractsをそのまま参照
6. **モダンなツール**: 最新のEthereumライブラリ
7. **デバッグ容易**: TypeScriptのデバッガーが使える

### デメリットと対策

1. **UUPSデプロイライブラリがない**
   - 対策: `uups-deployer.ts`として自前実装
   - 実装コンポーネント:
     - 実装コントラクトのデプロイ
     - プロキシコントラクトのデプロイ
     - 初期化データのエンコード
     - アドレス管理

2. **ガス見積もり**
   - 対策: デプロイ前に`estimateGas()`で確認

3. **コンパイル**
   - 対策: 既存のHardhat/Foundryを活用してABI/Bytecodeを生成

---

## 必要な準備

### 1. コントラクトのコンパイル（既存の方法を使用）

```bash
# Hardhatでコンパイル
npx hardhat compile

# または Foundryでコンパイル
forge build
```

### 2. new-deploy/ の初期化

```bash
mkdir new-deploy
cd new-deploy

# package.json作成
npm init -y

# 必要なパッケージをインストール
npm install viem dotenv

# 開発用パッケージ
npm install --save-dev typescript tsx @types/node

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
  "include": ["scripts/**/*", "config/**/*"],
  "exclude": ["node_modules", "dist"]
}
EOF
```

---

## 実装手順

### Week 1: 環境構築とUUPSデプロイヘルパー
- [ ] `new-deploy/`ディレクトリ作成
- [ ] `new-deploy/`内でnpm初期化
- [ ] `.env`、`package.json`、`tsconfig.json`作成
- [ ] アドレス管理ユーティリティ実装（`address-manager.ts`）
- [ ] **UUPSデプロイヘルパー実装（`uups-deployer.ts`）**
  - [ ] 実装コントラクトのデプロイ
  - [ ] プロキシコントラクトのデプロイ
  - [ ] 初期化データのエンコード
  - [ ] アドレスの保存

### Week 2-3: viemデプロイスクリプト実装
- [ ] v1.0デプロイスクリプト
  - [ ] PriceFeed
  - [ ] CJPY
  - [ ] FeePool（UUPS）
  - [ ] CurrencyOS（UUPS）
  - [ ] Yamato（UUPS）
  - [ ] YamatoActions（UUPS×6）
  - [ ] Pool（UUPS）
  - [ ] PriorityRegistry（UUPS）
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

### viemで対応できないもの

1. **コントラクトのコンパイル**: Hardhat/Foundryを使用
2. **Etherscan Verify**: 別ツール使用（hardhat-verify等）

### viemで対応できるもの

1. **新規デプロイ**: 全て対応可能（UUPSも自前実装で対応）
2. **初期設定**: setAddrs等
3. **アドレス管理**: `deployments/`へ読み書き
4. **アップグレード**: 直接実行またはSafe Transaction作成

### ローカル vs 本番

| 操作 | ローカル | 本番 |
|------|---------|------|
| コンパイル | Hardhat/Foundry | Hardhat/Foundry |
| 新規デプロイ | viem直接実行 | viem直接実行 |
| アップグレード | viem直接実行 | Safe Transaction |
| 初期設定 | viem直接実行 | viem/Safe |

---

## トラブルシューティング

### Q: UUPSプロキシのデプロイ方法は？
A: `uups-deployer.ts`で以下を実装：
1. 実装コントラクトをデプロイ
2. `encodeFunctionData`で初期化データを作成
3. ERC1967Proxyをデプロイ（実装アドレス + 初期化データ）
4. 両方のアドレスを保存

**初期化関数名について**:
- デフォルトは`'initialize'`
- `initFunction`パラメータで変更可能（例: `'__CurrencyOS_init'`, `'setUp'`）
- 各コントラクトのABIを確認して必要に応じて指定

### Q: アドレスファイルの読み書きは？
A: Node.jsの`fs`モジュールを使用。既存形式で保存。

### Q: 既存のdeploymentsディレクトリとの互換性は？
A: 完全に互換性あり。同じファイル名・形式で読み書き。

### Q: ABI/Bytecodeはどこから取得？
A: Hardhatの`artifacts/`ディレクトリまたはFoundryの`out/`ディレクトリから読み込み。

---

## 次のステップ

実装を開始する準備が整いました：

1. **`new-deploy/`ディレクトリ作成と初期化**
   ```bash
   mkdir new-deploy
   cd new-deploy
   npm init -y
   npm install viem dotenv
   npm install --save-dev typescript tsx @types/node
   ```

2. **環境変数設定**
   - `.env.example`作成
   - `.env`作成して実際の値を設定

3. **UUPSデプロイヘルパー実装**
   - `scripts/core/uups-deployer.ts`
   - `scripts/core/address-manager.ts`
   - `scripts/core/contract-deployer.ts`

4. **viemデプロイスクリプト作成**
   - v1.0デプロイスクリプト
   - 初期設定スクリプト

どこから始めますか？
