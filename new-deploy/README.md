# Yamato New Deploy Scripts

viemベースの新しいデプロイスクリプトです。

## セットアップ

### 1. 依存関係のインストール

```bash
cd new-deploy
npm install
```

### 2. 環境変数の設定

```bash
# .envファイルを作成
cp .env.example .env

# .envファイルを編集して実際の値を設定
```

必要な環境変数：
- `SEPOLIA_RPC_URL`: Sepolia RPC URL
- `MAINNET_RPC_URL`: Mainnet RPC URL  
- `PRIVATE_KEY`: デプロイ用の秘密鍵（0xプレフィックス付き）
- `ETHERSCAN_API_KEY`: Etherscan API Key（verify用）

### 3. ローカルノードの起動

**Anvilを使用（推奨）:**

```bash
# 別ターミナルで
cd ..
anvil
```

Anvilはポート8545で起動し、テスト用のアカウントと秘密鍵を自動生成します。
デフォルトのアカウント#0の秘密鍵は既に`.env.example`に設定されています。

### 4. コントラクトのコンパイル

デプロイ前に、必ずルートディレクトリでコントラクトをコンパイルしてください：

```bash
cd ..
npx hardhat compile
cd new-deploy
```

## 使い方

### v1.0 完全デプロイ

v1.0の全コントラクトを一括デプロイ：

```bash
# ローカル環境（Anvil）
npx hardhat run scripts/deploy/v1/deploy-all.ts --network localhost

# Sepolia環境
npx hardhat run scripts/deploy/v1/deploy-all.ts --network sepolia
```

**デプロイされるコントラクト（順番）:**
1. ChainLinkMock (ETH/USD, JPY/USD) - localhost環境のみ
2. PriceFeed (PriceFeedV3)
3. CJPY
4. FeePool
5. CurrencyOS (CurrencyOSV2)
6. Yamato (YamatoV3)
7. PledgeLib
8. YamatoDepositor (YamatoDepositorV2)
9. YamatoBorrower
10. YamatoRepayer (YamatoRepayerV2)
11. YamatoWithdrawer (YamatoWithdrawerV2)
12. YamatoRedeemer (YamatoRedeemerV4)
13. YamatoSweeper (YamatoSweeperV2)
14. Pool (PoolV2)
15. PriorityRegistry (PriorityRegistryV6)

**⚠️ 注意:**
- localhost環境では、ChainLinkMockが自動的にデプロイされます
- 本番環境（mainnet/sepolia）では、Chainlinkの実際のオラクルを使用します

### v1.0 初期設定

デプロイ後、初期設定を実行：

```bash
npx hardhat run scripts/setup/v1/setup-all.ts --network localhost
```

**実行される初期設定:**
1. `Yamato.setDeps()` - 全依存コントラクトの登録
2. `CurrencyOS.addYamato()` - YamatoをCurrencyOSに登録
3. `CJPY.setCurrencyOS()` + `CJPY.revokeGovernance()` - CJPY設定とガバナンス放棄

### v1.0 ガバナンス移譲（本番環境のみ）

本番環境では、ガバナンス権限をマルチシグウォレットに移譲します：

#### ステップ1: ガバナンス移譲

```bash
# .envにマルチシグアドレスを設定
UUPS_PROXY_ADMIN_MULTISIG_ADDRESS=0x...

# デプロイ用の秘密鍵で実行
npx hardhat run scripts/governance/v1-transfer-governance.ts --network sepolia
```

#### ステップ2: ガバナンス受け入れ

```bash
# .envのPRIVATE_KEYをマルチシグ署名者の秘密鍵に変更

# マルチシグ署名者の秘密鍵で実行
npx hardhat run scripts/governance/v1-accept-governance.ts --network sepolia
```

**⚠️ 重要:**
- ガバナンス移譲後、全てのアップグレードはマルチシグの承認が必要になります
- ローカルテストでは実行不要です

### 個別デプロイ・設定

```bash
# 個別デプロイ例
npx hardhat run scripts/deploy/v1/deploy-cjpy.ts --network localhost
npx hardhat run scripts/deploy/v1/deploy-yamato.ts --network localhost

# 個別設定例
npx hardhat run scripts/setup/v1/setup-yamato-deps.ts --network localhost
npx hardhat run scripts/setup/v1/setup-cjpy.ts --network localhost
```

### v1.5 完全デプロイ

v1.5の全コントラクト（YMT関連）を一括デプロイ：

```bash
# ローカル環境（Anvil）
npx hardhat run scripts/deploy/v1.5/deploy-all.ts --network localhost

# Sepolia環境
npx hardhat run scripts/deploy/v1.5/deploy-all.ts --network sepolia
```

**デプロイされるコントラクト（順番）:**
1. YmtVesting
2. YMT
3. veYMT
4. ScoreWeightController
5. YmtMinter
6. ScoreRegistry

### v1.5 アップグレード（v1.0 → v1.5）

**⚠️ 重要**: v1.5では既存のv1.0コントラクトをアップグレードする必要があります。

#### 実行方法の違い

| 環境 | 実行方法 | 説明 |
|-----|---------|------|
| **localhost** | 直接トランザクション実行 | テスト用。即座に実行される |
| **sepolia/mainnet** | Safe Transaction提案 | 本番用。マルチシグの承認が必要 |

```bash
# ローカル環境: 全アップグレード手順を一括実行
npx hardhat run scripts/upgrade/v1.5/upgrade-all.ts --network localhost

# 本番環境: Safe Transaction提案（マルチシグ承認が必要）
npx hardhat run scripts/upgrade/v1.5/upgrade-all.ts --network sepolia
```

**または個別実行:**

```bash
# 1. 新しい実装コントラクトをデプロイ
npx hardhat run scripts/upgrade/v1.5/deploy-implementations.ts --network localhost

# 2. プロキシをアップグレード
npx hardhat run scripts/upgrade/v1.5/upgrade-proxies.ts --network localhost

# 3. アップグレード後の初期設定
npx hardhat run scripts/upgrade/v1.5/post-upgrade-setup.ts --network localhost
```

**アップグレード対象（9コントラクト）:**
- YamatoRepayer: V2 → V3 (`upgradeTo`)
- YamatoRedeemer: V4 → V5 (`upgradeTo`)
- YamatoWithdrawer: V2 → V3 (`upgradeTo`)
- YamatoSweeper: V2 → V3 (`upgradeTo`)
- YamatoDepositor: V2 → V3 (`upgradeTo`)
- YamatoBorrower: V1 → V2 (`upgradeTo`)
- CurrencyOS: V2 → V3 (`upgradeTo`)
- Yamato: V3 → V4 (`upgradeTo`)
- FeePool: V1 → V2 (`upgradeToAndCall` + `initializeV2`)

### v1.5 初期設定

デプロイ後、初期設定を実行：

```bash
npx hardhat run scripts/setup/v1.5/setup-all.ts --network localhost
```

**実行される初期設定:**
1. `YmtVesting.setYmtToken()` - YMTトークンアドレスを設定
2. `YMT.setMinter()` - Minter権限を設定
3. `ScoreWeightController.addScore()` - ScoreRegistryを登録

### v1.5 ガバナンス移譲（本番環境のみ）

本番環境では、YMT関連コントラクトのガバナンス権限をマルチシグウォレットに移譲します：

#### ステップ1: ガバナンス移譲

```bash
# .envにマルチシグアドレスを設定
UUPS_PROXY_ADMIN_MULTISIG_ADDRESS=0x...
COMMUNITY_MULTISIG_ADDRESS=0x...

# デプロイ用の秘密鍵で実行
npx hardhat run scripts/governance/v1.5-transfer-governance.ts --network sepolia
```

#### ステップ2: ガバナンス受け入れ

```bash
# .envのPRIVATE_KEYをマルチシグ署名者の秘密鍵に変更

# マルチシグ署名者の秘密鍵で実行
npx hardhat run scripts/governance/v1.5-accept-governance.ts --network sepolia
```

**⚠️ 重要:**
- YMTとYmtVestingは`acceptGovernance()`を持たないため、`setAdmin()`のみで完了します
- YmtMinter、ScoreWeightController、ScoreRegistryは`acceptGovernance()`が必要です

### v2.0 ガバナンス移譲（本番環境のみ）

本番環境では、通貨別コントラクトのガバナンス権限をマルチシグウォレットに移譲します：

#### ステップ1: ガバナンス移譲

```bash
# .envにマルチシグアドレスを設定
UUPS_PROXY_ADMIN_MULTISIG_ADDRESS=0x...

# デプロイ用の秘密鍵で実行
CURRENCY=CUSD npx hardhat run scripts/governance/v2-transfer-governance.ts --network sepolia
# または
CURRENCY=CEUR npx hardhat run scripts/governance/v2-transfer-governance.ts --network sepolia
```

#### ステップ2: ガバナンス受け入れ

```bash
# .envのPRIVATE_KEYをマルチシグ署名者の秘密鍵に変更

# マルチシグ署名者の秘密鍵で実行
CURRENCY=CUSD npx hardhat run scripts/governance/v2-accept-governance.ts --network sepolia
# または
CURRENCY=CEUR npx hardhat run scripts/governance/v2-accept-governance.ts --network sepolia
```

## ディレクトリ構造

```
new-deploy/
├── scripts/
│   ├── core/              # コアモジュール
│   │   ├── address-manager.ts
│   │   ├── client.ts
│   │   ├── contract-deployer.ts
│   │   ├── contract-definitions.ts
│   │   ├── currency-manager.ts
│   │   └── uups-deployer.ts
│   ├── deploy/            # デプロイスクリプト
│   │   ├── v1/
│   │   ├── v1.5/
│   │   └── v2/
│   ├── setup/             # セットアップスクリプト
│   │   ├── v1/
│   │   ├── v1.5/
│   │   └── v2/
│   ├── upgrade/           # アップグレードスクリプト
│   │   ├── v1.5/
│   │   └── v2/
│   ├── governance/        # ガバナンス操作
│   │   ├── v1-*.ts
│   │   ├── v1.5-*.ts
│   │   └── v2-*.ts
│   ├── verify/            # Etherscan検証
│   │   └── verify-with-etherscan.ts
│   ├── test/              # テストスクリプト
│   │   ├── test-yamato-basic-operations.ts
│   │   └── test-all-versions.sh
│   └── check/             # デプロイ確認
│       ├── v1.0-check-deployment.ts
│       ├── v1.5-check-*.ts
│       └── v2.0-check-*.ts
├── config/
│   └── networks.ts        # ネットワーク設定
├── package.json
├── tsconfig.json
├── README.md
├── TEST_RESULTS.md
├── COMPARISON_REPORT.md
└── .env
```

## 注意事項

1. **コンパイル**: デプロイ前に必ずルートで`npx hardhat compile`を実行
2. **アドレス管理**: `../deployments/`ディレクトリに自動保存
3. **ガス代**: 十分なETHを用意してください
4. **秘密鍵管理**: `.env`ファイルは絶対にコミットしない

### v2.0 マルチカレンシー対応

v2.0では、CUSD（米ドル）とCEUR（ユーロ）を追加します。

#### 前提条件
- v1.5までのデプロイと設定が完了していること
- v1.5のアップグレードが完了していること

#### ステップ1: YmtOSデプロイ

```bash
npm run deploy:v2:ymtos
# または
npx hardhat run scripts/deploy/v2/deploy-ymtos.ts --network localhost
```

#### ステップ2: CJPYのCurrencyOSをV4にアップグレード

```bash
npm run upgrade:v2:cjpy-currencyos
# または
npx hardhat run scripts/upgrade/v2/upgrade-cjpy-currencyos.ts --network localhost
```

#### ステップ3: ScoreWeightControllerをV2にアップグレード

```bash
npm run upgrade:v2:score-weight-controller
# または
npx hardhat run scripts/upgrade/v2/upgrade-score-weight-controller.ts --network localhost
```

#### ステップ4: CUSDデプロイ

```bash
npm run deploy:v2:cusd
# または
CURRENCY=CUSD npx hardhat run scripts/deploy/v2/deploy-all-cusd.ts --network localhost
```

**デプロイされるコントラクト:**
1. CUSD トークン
2. PriceFeedSingle (USD用)
3. CurrencyOS (CUSD)
4. Yamato (CUSD)
5. YamatoActions (CUSD)
6. Pool (CUSD)
7. PriorityRegistry (CUSD)
8. ScoreRegistry (CUSD)

#### ステップ5: CUSD初期設定

```bash
npm run setup:v2:cusd
# または
CURRENCY=CUSD npx hardhat run scripts/setup/v2/setup-all-cusd.ts --network localhost
```

**実行される初期設定:**
1. `Yamato.setDeps()`
2. `CurrencyOS.addYamato()`
3. `CurrencyOS.setYmtOS()`
4. `CUSD.setCurrencyOS()` + `CUSD.revokeGovernance()`
5. `YmtOS.addCurrencyOS()`
6. `Yamato.setScoreRegistry()`

#### ステップ6: CEURデプロイ（オプション）

```bash
npm run deploy:v2:ceur
# または
CURRENCY=CEUR npx hardhat run scripts/deploy/v2/deploy-all-ceur.ts --network localhost
```

**デプロイされるコントラクト:**
1. ChainLinkMock (EUR/USD) - localhost環境のみ（自動実行）
2. CEUR トークン
3. PriceFeed (EUR用 - PriceFeedV3)
4. CurrencyOS (CEUR)
5. Yamato (CEUR)
6. YamatoActions (CEUR)
7. Pool (CEUR)
8. PriorityRegistry (CEUR)
9. ScoreRegistry (CEUR)

**⚠️ 注意:**
- localhost環境では、`deploy-all-ceur.ts`が自動的にChainLinkMock (EUR/USD)をデプロイします
- 本番環境（mainnet/sepolia）では、Chainlinkの実際のEUR/USDオラクルを使用します

#### ステップ7: CEUR初期設定

```bash
npm run setup:v2:ceur
# または
CURRENCY=CEUR npx hardhat run scripts/setup/v2/setup-all-ceur.ts --network localhost
```

**実行される初期設定:**
1. `Yamato.setDeps()`
2. `CurrencyOS.addYamato()`
3. `CurrencyOS.setYmtOS()`
4. `CEUR.setCurrencyOS()` + `CEUR.revokeGovernance()`
5. `Yamato.setScoreRegistry()`

⚠️ **注意:** CEURは`YmtOS.addCurrencyOS()`を実行しません（index.mdに基づく）

#### v2.0 完全フロー（ローカルテスト用）

```bash
# 1. v1.0デプロイ
npm run deploy:v1
npm run setup:v1

# 2. v1.5デプロイ
npm run deploy:v1.5
npm run setup:v1.5

# 3. v1.5アップグレード
npm run upgrade:v1.5

# 4. v2.0デプロイ
npm run deploy:v2:ymtos
npm run upgrade:v2:cjpy-currencyos
npm run upgrade:v2:score-weight-controller

# 5. CUSDデプロイ
npm run deploy:v2:cusd
npm run setup:v2:cusd

# 6. CEURデプロイ（オプション）
npm run deploy:v2:ceur
npm run setup:v2:ceur
```

## コントラクト定義の一元管理

全てのコントラクト名は`scripts/core/contract-definitions.ts`で一元管理されています。

### 利点

1. **一貫性**: 全スクリプトで同じコントラクト名を使用
2. **保守性**: コントラクト名の変更が一箇所で完結
3. **型安全性**: TypeScriptの型システムで誤りを防止
4. **ライブラリリンク管理**: PledgeLibリンクが必要なコントラクトを明示的に定義

### 使用例

```typescript
import { 
  V1_CONTRACTS, 
  V1_5_UPGRADE_IMPLEMENTATIONS,
  V2_CURRENCY_CONTRACTS,
  requiresPledgeLib 
} from './core/contract-definitions';

// v1.0のコントラクト名を取得
const yamatoContract = V1_CONTRACTS.Yamato; // 'YamatoV3'

// v1.5アップグレード実装を取得
const newYamato = V1_5_UPGRADE_IMPLEMENTATIONS.Yamato; // 'YamatoV4'

// v2.0通貨別コントラクトを取得
const currencyOS = V2_CURRENCY_CONTRACTS.CurrencyOS; // 'CurrencyOSV4'

// ライブラリリンクが必要かチェック
const needsLib = requiresPledgeLib('YamatoBorrowerV2', 'v2'); // true
```

### 定義されているコントラクト

- **v1.0**: 基本コントラクト（CJPY、Yamato、Actions、PriceFeed等）
- **v1.5**: 新規コントラクト（YMT、veYMT等）とアップグレード実装
- **v2.0**: マルチカレンシー対応コントラクト（CUSD、CEUR、YmtOS等）

詳細は`scripts/core/contract-definitions.ts`を参照してください。

## トラブルシューティング

### ABI/Bytecodeが見つからない

```bash
# ルートディレクトリでコンパイル
cd ..
npx hardhat compile
cd new-deploy
```

### アドレスが見つからない

依存するコントラクトが先にデプロイされているか確認してください。

### RPC接続エラー

`.env`のRPC URLが正しく設定されているか確認してください。

### "invalid chain id for signer" エラー

ローカルテストでこのエラーが出る場合：

1. **Anvilが起動しているか確認**
   ```bash
   # 別ターミナルで
   anvil
   ```

2. **Chain IDの確認**
   - Anvilのデフォルトchain ID: 31337
   - `.env`の`LOCALHOST_CHAIN_ID`が31337になっているか確認

3. **ポートの確認**
   - Anvilのデフォルトポート: 8545
   - `.env`の`LOCALHOST_RPC_URL`が`http://127.0.0.1:8545`になっているか確認

4. **既存のプロセスの確認**
   ```bash
   # 既存のノードを停止
   pkill -f "anvil"
   pkill -f "hardhat node"
   ```

### ローカル vs 本番環境

- **ローカル（Anvil）**: テスト・デバッグ用。失敗してもやり直し可能
- **Sepolia**: テストネット。Etherscanで確認可能
- **Mainnet**: 本番環境。慎重に実行してください

## Etherscan検証

デプロイ後、コントラクトをEtherscanで検証できます：

```bash
# v1.0 + v1.5の全コントラクト検証
npx hardhat run scripts/verify/verify-with-etherscan.ts --network sepolia

# CUSD追加検証（PriceFeedSingleを含む）
CURRENCY=CUSD npx hardhat run scripts/verify/verify-with-etherscan.ts --network sepolia

# CEUR追加検証（CEURトークンを含む）
CURRENCY=CEUR npx hardhat run scripts/verify/verify-with-etherscan.ts --network sepolia
```

**検証されるコントラクト:**
- 実装コントラクト（UUPS実装）
- 非UUPSコントラクト（CJPY、CUSD、CEUR、YMT、veYMT、YmtVesting等）
- プロキシ検証URLの表示（手動検証が必要）

**⚠️ 注意:**
- プロキシ検証は手動でEtherscanのProxy Contract Checkerから実行する必要があります
- スクリプトが表示するURLを開いて手動で検証してください

## 基本動作テスト

デプロイ後のYamatoコントラクトの基本動作をテストできます：

```bash
# CJPY用（デフォルト）
npx hardhat run scripts/test/test-yamato-basic-operations.ts --network localhost

# CUSD用
CURRENCY=CUSD npx hardhat run scripts/test/test-yamato-basic-operations.ts --network localhost

# CEUR用
CURRENCY=CEUR npx hardhat run scripts/test/test-yamato-basic-operations.ts --network localhost
```

**テスト内容:**
1. `deposit()` - ETHを預ける（1 ETH）
2. `borrow()` - 通貨を借りる（500通貨単位）
3. `repay()` - 借入額を返す（残高と債務の小さい方）
4. `withdraw()` - ETHを引き出す（一部引き出し）

**テスト結果:**
- ✅ v1.0/v1.5 (CJPY): 全操作が正常に動作
- ✅ v2.0 (CUSD): 全操作が正常に動作
- ✅ v2.0 (CEUR): 全操作が正常に動作

詳細なテスト結果は`TEST_RESULTS.md`を参照してください。

## 全バージョンテスト

全てのバージョンで一括テストを実行：

```bash
# 全バージョンのテストを実行
./scripts/test/test-all-versions.sh localhost
```

このスクリプトは以下の順番でテストを実行します：
1. v1.0/v1.5 (CJPY)
2. v2.0 (CUSD)
3. v2.0 (CEUR)

