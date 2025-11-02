# Yamato コントラクトバージョン情報

このドキュメントは、Yamato プロトコルの各バージョンでデプロイされるコントラクトとそのバージョンをまとめたものです。

## 目次

- [Yamato v1.0](#yamato-v10)
- [Yamato v1.5](#yamato-v15)
- [Yamato v2.0](#yamato-v20)
- [バージョン比較表](#バージョン比較表)

---

## Yamato v1.0

### 概要
最初のメジャーリリース。CJPY（日本円ペッグステーブルコイン）のミント・管理機能を提供。

### コアコントラクト

| コントラクト名 | バージョン | ファイル名 | 説明 |
|--------------|----------|-----------|------|
| Yamato | v3 | YamatoV3.sol | メインコントラクト |
| CurrencyOS | v2 | CurrencyOSV2.sol | 通貨管理システム |
| CJPY | - | CJPY.sol | 日本円ペッグステーブルコイン（非UUPS） |

### アクションコントラクト

| コントラクト名 | バージョン | ファイル名 | 説明 |
|--------------|----------|-----------|------|
| YamatoDepositor | v2 | YamatoDepositorV2.sol | 担保預け入れ |
| YamatoBorrower | v1 | YamatoBorrower.sol | 通貨借入 |
| YamatoRepayer | v2 | YamatoRepayerV2.sol | 債務返済 |
| YamatoWithdrawer | v2 | YamatoWithdrawerV2.sol | 担保引き出し |
| YamatoRedeemer | v4 | YamatoRedeemerV4.sol | 償還 |
| YamatoSweeper | v2 | YamatoSweeperV2.sol | 清算 |

### サポートコントラクト

| コントラクト名 | バージョン | ファイル名 | 説明 |
|--------------|----------|-----------|------|
| PriceFeed | v3 | PriceFeedV3.sol | 価格オラクル（ETH/JPY） |
| FeePool | v1 | FeePool.sol | 手数料プール |
| Pool | v2 | PoolV2.sol | 担保プール |
| PriorityRegistry | v6 | PriorityRegistryV6.sol | 優先順位レジストリ |

### デプロイ手順
```bash
npx hardhat deploy --tags PriceFeed --network sepolia
npx hardhat deploy --tags CJPY --network sepolia
npx hardhat deploy --tags FeePool --network sepolia
npx hardhat deploy --tags CurrencyOS --network sepolia
npx hardhat deploy --tags Yamato --network sepolia
npx hardhat deploy --tags YamatoAction --network sepolia
npx hardhat deploy --tags Pool --network sepolia
npx hardhat deploy --tags PriorityRegistry --network sepolia
npx hardhat deploy --tags setDeps --network sepolia
npx hardhat deploy --tags addYamato --network sepolia
npx hardhat deploy --tags setCOSCJPY --network sepolia
npx hardhat deploy --tags transferGovernance --network sepolia
```

---

## Yamato v1.5

### 概要
YMTガバナンストークンとveYMT（投票エスクローYMT）を導入。既存のコントラクトをアップグレード。

### アップグレードされたコントラクト

| コントラクト名 | v1.0 → v1.5 | ファイル名 | 変更内容 |
|--------------|-------------|-----------|---------|
| YamatoRepayer | v2 → v3 | YamatoRepayerV3.sol | YMTリワード機能追加 |
| YamatoRedeemer | v4 → v5 | YamatoRedeemerV5.sol | YMTリワード機能追加 |
| YamatoWithdrawer | v2 → v3 | YamatoWithdrawerV3.sol | YMTリワード機能追加 |
| YamatoSweeper | v2 → v3 | YamatoSweeperV3.sol | YMTリワード機能追加 |
| YamatoDepositor | v2 → v3 | YamatoDepositorV3.sol | YMTリワード機能追加 |
| YamatoBorrower | v1 → v2 | YamatoBorrowerV2.sol | YMTリワード機能追加 |
| CurrencyOS | v2 → v3 | CurrencyOSV3.sol | YMT統合 |
| Yamato | v3 → v4 | YamatoV4.sol | YMTスコアリング機能追加 |
| FeePool | v1 → v2 | FeePoolV2.sol | YMT分配機能追加 |

### 新規追加コントラクト

| コントラクト名 | バージョン | ファイル名 | 説明 |
|--------------|----------|-----------|------|
| YMT | - | YMT.sol | ガバナンストークン（非UUPS） |
| veYMT | - | veYMT.sol | 投票エスクローYMT（非UUPS） |
| YmtVesting | - | YmtVesting.sol | YMTベスティング管理（非UUPS） |
| YmtMinter | v1 | YmtMinter.sol | YMTミント管理 |
| ScoreWeightController | v1 | ScoreWeightController.sol | スコアウェイト計算 |
| ScoreRegistry | v1 | ScoreRegistry.sol | スコア記録 |

### アップグレード手順
```bash
# 新規コントラクトのデプロイ
npx hardhat deploy --tags YmtVesting --network sepolia
npx hardhat deploy --tags YMT --network sepolia
npx hardhat deploy --tags veYMT --network sepolia
npx hardhat deploy --tags ScoreWeightController --network sepolia
npx hardhat deploy --tags YmtMinter --network sepolia
npx hardhat deploy --tags ScoreRegistry --network sepolia

# 実装のアップグレード
npx hardhat run upgrade/batches/v1.5-update-deployImpl.ts --network sepolia
npx hardhat deploy --tags Verify --network sepolia

# プロキシのアップグレード
npx hardhat run upgrade/batches/v1.5-update-safePropose.ts --network sepolia
npx hardhat run upgrade/batches/v1.5-update-safePropose2.ts --network sepolia

# アドレス初期設定
npx hardhat deploy --tags setYmtToken --network sepolia
npx hardhat deploy --tags setMinter --network sepolia
npx hardhat deploy --tags addScore --network sepolia

# ガバナンス移行
npx hardhat deploy --tags transferGovernanceV15 --network sepolia
npx hardhat run upgrade/safeTxCreate/091_v15acceptGovernance.ts --network sepolia
```

---

## Yamato v2.0

### 概要
マルチカレンシー対応。CUSD（米ドルペッグ）とCEUR（ユーロペッグ）を追加。YmtOSによる統合管理。

### 新規追加コントラクト

| コントラクト名 | バージョン | ファイル名 | 説明 |
|--------------|----------|-----------|------|
| YmtOS | - | YmtOS.sol | YMT統合管理システム（バージョン指定なし） |
| CUSD | - | CUSD.sol | 米ドルペッグステーブルコイン（非UUPS） |
| CEUR | - | CEUR.sol | ユーロペッグステーブルコイン（非UUPS） |
| PriceFeedSingle | v1 | PriceFeedSingle.sol | 単一ペア価格フィード（CUSD用） |

### 通貨別デプロイコントラクト（CUSD/CEUR）

各通貨ごとに以下のコントラクトがデプロイされます：

| コントラクト名 | バージョン | ファイル名 | 備考 |
|--------------|----------|-----------|------|
| Yamato | v4 | YamatoV4.sol | 通貨別インスタンス |
| CurrencyOS | v4 | CurrencyOSV4.sol | v3からv4へアップグレード |
| YamatoDepositor | v3 | YamatoDepositorV3.sol | 通貨別インスタンス |
| YamatoBorrower | v2 | YamatoBorrowerV2.sol | 通貨別インスタンス |
| YamatoRepayer | v3 | YamatoRepayerV3.sol | 通貨別インスタンス |
| YamatoWithdrawer | v3 | YamatoWithdrawerV3.sol | 通貨別インスタンス |
| YamatoRedeemer | v5 | YamatoRedeemerV5.sol | 通貨別インスタンス |
| YamatoSweeper | v3 | YamatoSweeperV3.sol | 通貨別インスタンス |
| Pool | v2 | PoolV2.sol | 通貨別インスタンス |
| PriorityRegistry | v6 | PriorityRegistryV6.sol | 通貨別インスタンス |
| ScoreRegistry | v1 | ScoreRegistry.sol | 通貨別インスタンス |
| PriceFeed | v3/v1 | PriceFeedV3.sol / PriceFeedSingle.sol | CEUR: v3, CUSD: v1 |

### アップグレードされたコントラクト

| コントラクト名 | v1.5 → v2.0 | ファイル名 | 変更内容 |
|--------------|-------------|-----------|---------|
| ScoreWeightController | v1 → v2 | ScoreWeightControllerV2.sol | マルチカレンシー対応 |

### デプロイ手順

#### CUSD デプロイ
```bash
sed -i '' 's/^CURRENCY=.*/CURRENCY=CUSD/' .env
npx hardhat deploy --tags YmtOS_V2 --network sepolia
npx hardhat deploy --tags PriceFeed_USD_V2 --network sepolia
npx hardhat deploy --tags CURRENCY_V2 --network sepolia
npx hardhat deploy --tags CurrencyOS_V2 --network sepolia
npx hardhat deploy --tags Yamato_V2 --network sepolia
npx hardhat deploy --tags YamatoAction_V2 --network sepolia
npx hardhat deploy --tags Pool_V2 --network sepolia
npx hardhat deploy --tags PriorityRegistry_V2 --network sepolia
npx hardhat deploy --tags setDeps_V2 --network sepolia
npx hardhat deploy --tags addYamato_V2 --network sepolia
npx hardhat deploy --tags setYmtOS_V2 --network sepolia
npx hardhat deploy --tags setCurrencyOS_CURRRECY_V2 --network sepolia
npx hardhat deploy --tags addCurrencyOS_YmtOS_V2 --network sepolia
npx hardhat deploy --tags ScoreRegistry_V2 --network sepolia
npx hardhat deploy --tags setScoreRegistry_V2 --network sepolia
npx hardhat run upgrade/batches/v2-update-deployImpl.ts --network sepolia
npx hardhat run upgrade/batches/v2-update-safePropose.ts --network sepolia
```

#### CEUR デプロイ
```bash
sed -i '' 's/^CURRENCY=.*/CURRENCY=CEUR/' .env
npx hardhat deploy --tags PriceFeed_EUR_V2 --network sepolia
npx hardhat deploy --tags CURRENCY_V2 --network sepolia
npx hardhat deploy --tags CurrencyOS_V2 --network sepolia
npx hardhat deploy --tags Yamato_V2 --network sepolia
npx hardhat deploy --tags YamatoAction_V2 --network sepolia
npx hardhat deploy --tags Pool_V2 --network sepolia
npx hardhat deploy --tags PriorityRegistry_V2 --network sepolia
npx hardhat deploy --tags setDeps_V2 --network sepolia
npx hardhat deploy --tags addYamato_V2 --network sepolia
npx hardhat deploy --tags setYmtOS_V2 --network sepolia
npx hardhat deploy --tags setCurrencyOS_CURRRECY_V2 --network sepolia
npx hardhat deploy --tags ScoreRegistry_V2 --network sepolia
npx hardhat deploy --tags setScoreRegistry_V2 --network sepolia
npx hardhat run upgrade/batches/v2-update-safeProposeSecond.ts --network sepolia
```

#### 権限委譲
```bash
# CUSD
sed -i '' 's/^CURRENCY=.*/CURRENCY=CUSD/' .env
npx hardhat deploy --tags transferGovernance_V2 --network sepolia
npx hardhat run upgrade/batches/v2-update-governance.ts --network sepolia

# CEUR
sed -i '' 's/^CURRENCY=.*/CURRENCY=CEUR/' .env
npx hardhat deploy --tags transferGovernance_V2 --network sepolia
npx hardhat run upgrade/batches/v2-update-governanceSecond.ts --network sepolia
```

---

## バージョン比較表

### 主要コントラクトのバージョン遷移

| コントラクト名 | v1.0 | v1.5 | v2.0 | 備考 |
|--------------|------|------|------|------|
| Yamato | v3 | v4 | v4 | v1.5でYMTスコアリング追加 |
| CurrencyOS | v2 | v3 | v4 | v2.0でマルチカレンシー対応 |
| YamatoDepositor | v2 | v3 | v3 | v1.5でYMTリワード追加 |
| YamatoBorrower | v1 | v2 | v2 | v1.5でYMTリワード追加 |
| YamatoRepayer | v2 | v3 | v3 | v1.5でYMTリワード追加 |
| YamatoWithdrawer | v2 | v3 | v3 | v1.5でYMTリワード追加 |
| YamatoRedeemer | v4 | v5 | v5 | v1.5でYMTリワード追加 |
| YamatoSweeper | v2 | v3 | v3 | v1.5でYMTリワード追加 |
| FeePool | v1 | v2 | v2 | v1.5でYMT分配機能追加 |
| PriceFeed | v3 | v3 | v3 | 変更なし（CJPY/CEUR用） |
| PriceFeedSingle | - | - | v1 | v2.0で新規追加（CUSD用） |
| Pool | v2 | v2 | v2 | 変更なし |
| PriorityRegistry | v6 | v6 | v6 | 変更なし |
| ScoreWeightController | - | v1 | v2 | v1.5で新規追加、v2.0でマルチカレンシー対応 |
| ScoreRegistry | - | v1 | v1 | v1.5で新規追加 |
| YmtMinter | - | v1 | v1 | v1.5で新規追加 |
| YMT | - | - | - | v1.5で新規追加（非UUPS） |
| veYMT | - | - | - | v1.5で新規追加（非UUPS） |
| YmtVesting | - | - | - | v1.5で新規追加（非UUPS） |
| YmtOS | - | - | - | v2.0で新規追加（バージョン指定なし） |

### 対応通貨

| バージョン | 対応通貨 |
|----------|---------|
| v1.0 | CJPY（日本円） |
| v1.5 | CJPY（日本円） |
| v2.0 | CJPY（日本円）、CUSD（米ドル）、CEUR（ユーロ） |

---

## 注意事項

1. **バージョン番号について**
   - コントラクトファイル名のV2、V3などは、そのコントラクトのバージョンを示します
   - デプロイスクリプトの第4引数（versionSpecification）がこのバージョン番号に対応します
   - バージョン番号が「-」のコントラクトは、バージョン指定なしのデプロイまたは非UUPSコントラクトです
   - v1.0時点でバージョンが2以上のコントラクトは、v1.0リリース前に既にアップグレードされていたことを意味します

2. **アップグレード方式**
   - UUPSパターンのコントラクトはアップグレード可能です（Yamato、CurrencyOS、各Actionコントラクト等）
   - プロキシアドレスは変更されず、実装アドレスのみが更新されます
   - YMT、veYMT、YmtVestingは非UUPSのため、アップグレード不可能です
   - 通貨コントラクト（CJPY、CUSD、CEUR）も非UUPSのため、アップグレード不可能です

3. **マルチカレンシー対応（v2.0）**
   - CUSD、CEURはそれぞれ独立したYamatoインスタンスを持ちます
   - 各通貨のインスタンスはYmtOSで統合管理されます
   - ScoreRegistryは各通貨ごとに独立して存在します

4. **デプロイ順序**
   - 依存関係があるため、記載された順序でデプロイする必要があります
   - 特にv1.5、v2.0へのアップグレード時は、バッチスクリプトの実行順序に注意してください

5. **環境変数**
   - v2.0では`CURRENCY`環境変数で対象通貨を指定します
   - デプロイ前に必ず正しい通貨コードが設定されていることを確認してください

---

## 関連ドキュメント

- [デプロイ手順](./index.md)
- [Yamato v1.0 仕様](../v1.0/)
- [Yamato v1.5 仕様](../v1.5/)

