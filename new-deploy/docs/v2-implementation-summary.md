# v2.0 実装サマリー

## 概要

Yamato v2.0のマルチカレンシー対応デプロイスクリプトを`hardhat-viem`ベースで実装しました。

## 実装完了項目

### ✅ 1. コアユーティリティ

- **`scripts/core/currency-manager.ts`**: 通貨管理ユーティリティ
  - `getCurrency()`: 環境変数からCURRENCYを取得
  - `getCurrencyContractName()`: 通貨別コントラクト名生成
  - `getCurrencyInfo()`: 通貨情報取得
  - `getPriceFeedContractName()`: 通貨別PriceFeed名取得

### ✅ 2. デプロイスクリプト

#### 共有コントラクト
- **`deploy-ymtos.ts`**: YmtOS（マルチカレンシー統合管理）
- **`deploy-cusd.ts`**: CUSD トークン
- **`deploy-ceur.ts`**: CEUR トークン
- **`deploy-pricefeed-single.ts`**: PriceFeedSingle（CUSD用）

#### 通貨別コントラクト（CURRENCY環境変数使用）
- **`deploy-currency-currencyos.ts`**: CurrencyOSV4
- **`deploy-currency-yamato.ts`**: YamatoV4
- **`deploy-currency-actions.ts`**: 全アクションコントラクト（6個）
  - YamatoDepositorV3
  - YamatoBorrowerV2
  - YamatoRepayerV3
  - YamatoWithdrawerV3
  - YamatoRedeemerV5
  - YamatoSweeperV3
- **`deploy-currency-pool.ts`**: PoolV2
- **`deploy-currency-priority-registry.ts`**: PriorityRegistryV6
- **`deploy-currency-score-registry.ts`**: ScoreRegistry

#### 統合デプロイスクリプト
- **`deploy-all-cusd.ts`**: CUSD完全デプロイ
- **`deploy-all-ceur.ts`**: CEUR完全デプロイ

### ✅ 3. セットアップスクリプト

#### 通貨別セットアップ（CURRENCY環境変数使用）
- **`setup-currency-yamato-deps.ts`**: Yamato.setDeps()
- **`setup-currency-currencyos-add-yamato.ts`**: CurrencyOS.addYamato()
- **`setup-currency-currencyos-set-ymtos.ts`**: CurrencyOS.setYmtOS()
- **`setup-currency-token.ts`**: Currency.setCurrencyOS() + revokeGovernance()
- **`setup-ymtos-add-currencyos.ts`**: YmtOS.addCurrencyOS()
- **`setup-currency-yamato-score-registry.ts`**: Yamato.setScoreRegistry()

#### 統合セットアップスクリプト
- **`setup-all-cusd.ts`**: CUSD完全セットアップ
- **`setup-all-ceur.ts`**: CEUR完全セットアップ

### ✅ 4. アップグレードスクリプト

- **`upgrade-cjpy-currencyos.ts`**: CJPYのCurrencyOS V3→V4アップグレード
- **`upgrade-score-weight-controller.ts`**: ScoreWeightController V1→V2アップグレード

### ✅ 5. ガバナンス移譲スクリプト

- **`v2-transfer-governance.ts`**: 通貨別コントラクトのガバナンス移譲（13個）
- **`v2-accept-governance.ts`**: マルチシグによるガバナンス承認（13個）

### ✅ 6. ドキュメント

- **`README.md`**: v2.0セクション追加
  - YmtOSデプロイ手順
  - CJPYアップグレード手順
  - CUSD/CEURデプロイ手順
  - 完全フロー例
- **`package.json`**: v2.0用npmスクリプト追加
  - `deploy:v2:ymtos`
  - `deploy:v2:cusd`
  - `deploy:v2:ceur`
  - `setup:v2:cusd`
  - `setup:v2:ceur`
  - `upgrade:v2:cjpy-currencyos`
  - `upgrade:v2:score-weight-controller`
  - `governance:transfer:v2`
  - `governance:accept:v2`

## 主要な設計決定

### 1. 通貨別コントラクト名規則

通貨別のコントラクトは`ContractName_CURRENCY`形式で命名：
- 例: `Yamato_CUSD`, `CurrencyOS_CEUR`, `Pool_CUSD`
- `address-manager.ts`でそのまま使用可能

### 2. CURRENCY環境変数

通貨別デプロイスクリプトは`CURRENCY`環境変数を使用：
```bash
CURRENCY=CUSD npx hardhat run scripts/deploy/v2/deploy-currency-yamato.ts
CURRENCY=CEUR npx hardhat run scripts/deploy/v2/deploy-currency-yamato.ts
```

### 3. PriceFeed選択ロジック

- **CUSD**: `PriceFeedSingle`（USD/USD = 1.0固定）
- **CJPY/CEUR**: `PriceFeedV3`（Chainlink Oracle使用）

### 4. YmtOS.addCurrencyOS()の実行条件

- **CUSD**: 実行する
- **CEUR**: 実行しない（`index.md`に基づく）

### 5. ライブラリリンク

PledgeLibのリンクが必要なコントラクト（v2.0）：
- YamatoDepositorV3 ✅
- YamatoBorrowerV2 ✅
- YamatoRepayerV3 ✅
- YamatoWithdrawerV3 ✅
- YamatoRedeemerV5 ✅
- YamatoSweeperV3 ✅
- PriorityRegistryV6 ✅
- ScoreRegistry ✅

リンク不要なコントラクト：
- YamatoV4 ❌
- CurrencyOSV4 ❌
- PoolV2 ❌

### 6. Safe Transaction対応

- **localhost**: 直接トランザクション実行
- **その他（sepolia, mainnet）**: Safe Transaction提案
- アップグレードとガバナンス移譲で実装

## デプロイフロー

### v2.0 完全デプロイフロー

```
v1.0 → v1.5 → v2.0
```

#### v2.0詳細フロー

```
1. YmtOSデプロイ
   ↓
2. CJPYのCurrencyOSをV4にアップグレード
   ↓
3. ScoreWeightControllerをV2にアップグレード
   ↓
4. CUSDデプロイ（トークン、PriceFeedSingle、CurrencyOS、Yamato、Actions、Pool、PriorityRegistry、ScoreRegistry）
   ↓
5. CUSDセットアップ（setDeps、addYamato、setYmtOS、setCurrencyOS、addCurrencyOS、setScoreRegistry）
   ↓
6. CEURデプロイ（トークン、PriceFeed、CurrencyOS、Yamato、Actions、Pool、PriorityRegistry、ScoreRegistry）
   ↓
7. CEURセットアップ（setDeps、addYamato、setYmtOS、setCurrencyOS、setScoreRegistry）
```

## テスト状況

### ✅ 実装完了
- 全デプロイスクリプト
- 全セットアップスクリプト
- 全アップグレードスクリプト
- 全ガバナンス移譲スクリプト

### 🔜 次のステップ
- ローカルテスト実行
- Sepoliaテスト
- 本番デプロイ

## 互換性

### v1.0との互換性
- ✅ 既存のv1.0デプロイメントに影響なし
- ✅ CJPYは引き続き使用可能

### v1.5との互換性
- ✅ YMT、veYMT、YmtMinterは全通貨で共有
- ✅ FeePoolは全通貨で共有
- ✅ ScoreWeightControllerは全通貨で共有

## 注意事項

1. **環境変数**: `CURRENCY`を正しく設定すること
2. **デプロイ順序**: 依存関係に従って順番にデプロイすること
3. **ガバナンス**: 本番環境では必ずマルチシグを使用すること
4. **テスト**: 本番デプロイ前に必ずローカル/テストネットで確認すること
5. **PledgeLib**: 通貨別デプロイでも共有（v1.0でデプロイ済み）

## ファイル構成

```
new-deploy/
├── scripts/
│   ├── core/
│   │   ├── currency-manager.ts          # 新規
│   │   ├── address-manager.ts
│   │   ├── uups-deployer.ts
│   │   ├── contract-deployer-hh.ts
│   │   └── safe-transaction.ts
│   ├── deploy/
│   │   └── v2/                          # 新規
│   │       ├── deploy-ymtos.ts
│   │       ├── deploy-cusd.ts
│   │       ├── deploy-ceur.ts
│   │       ├── deploy-pricefeed-single.ts
│   │       ├── deploy-currency-currencyos.ts
│   │       ├── deploy-currency-yamato.ts
│   │       ├── deploy-currency-actions.ts
│   │       ├── deploy-currency-pool.ts
│   │       ├── deploy-currency-priority-registry.ts
│   │       ├── deploy-currency-score-registry.ts
│   │       ├── deploy-all-cusd.ts
│   │       └── deploy-all-ceur.ts
│   ├── setup/
│   │   └── v2/                          # 新規
│   │       ├── setup-currency-yamato-deps.ts
│   │       ├── setup-currency-currencyos-add-yamato.ts
│   │       ├── setup-currency-currencyos-set-ymtos.ts
│   │       ├── setup-currency-token.ts
│   │       ├── setup-ymtos-add-currencyos.ts
│   │       ├── setup-currency-yamato-score-registry.ts
│   │       ├── setup-all-cusd.ts
│   │       └── setup-all-ceur.ts
│   ├── upgrade/
│   │   └── v2/                          # 新規
│   │       ├── upgrade-cjpy-currencyos.ts
│   │       └── upgrade-score-weight-controller.ts
│   └── governance/
│       ├── v2-transfer-governance.ts    # 新規
│       └── v2-accept-governance.ts      # 新規
├── docs/
│   ├── library-linking-analysis.md
│   └── v2-implementation-summary.md     # 本ファイル
├── package.json                         # v2.0スクリプト追加
└── README.md                            # v2.0セクション追加
```

## 実装統計

- **新規ファイル**: 25個
- **更新ファイル**: 3個（package.json, README.md, address-manager.ts）
- **総行数**: 約2,500行
- **対応通貨**: CJPY, CUSD, CEUR
- **デプロイ対象コントラクト**: 
  - 共有: 1個（YmtOS）
  - 通貨別: 各通貨あたり14個（トークン、PriceFeed、CurrencyOS、Yamato、Actions×6、Pool、PriorityRegistry、ScoreRegistry）
  - アップグレード: 2個（CurrencyOSV4、ScoreWeightControllerV2）

## まとめ

v2.0のマルチカレンシー対応デプロイスクリプトの実装が完了しました。全てのスクリプトは`hardhat-viem`ベースで実装され、型安全性とクロスプラットフォーム互換性を確保しています。

次のステップは、ローカル環境での完全なエンドツーエンドテストです。

