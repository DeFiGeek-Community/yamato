# Yamato コントラクトバージョン情報

このドキュメントは、Yamato プロトコルの各バージョンでデプロイされるコントラクトとそのバージョンをまとめたものです。

---

## Yamato v1.0（初期リリース）

### コアコントラクト
- **Yamato**: YamatoV3.sol
- **CurrencyOS**: CurrencyOSV2.sol
- **CJPY**: CJPY.sol（非UUPS）

### アクションコントラクト
- **YamatoDepositor**: YamatoDepositorV2.sol
- **YamatoBorrower**: YamatoBorrower.sol
- **YamatoRepayer**: YamatoRepayerV2.sol
- **YamatoWithdrawer**: YamatoWithdrawerV2.sol
- **YamatoRedeemer**: YamatoRedeemerV4.sol
- **YamatoSweeper**: YamatoSweeperV2.sol

### サポートコントラクト
- **PriceFeed**: PriceFeedV3.sol
- **FeePool**: FeePool.sol
- **Pool**: PoolV2.sol
- **PriorityRegistry**: PriorityRegistryV6.sol

### ライブラリ
- **PledgeLib**: PledgeLib.sol

---

## Yamato v1.5（YMTトークン導入）

### 🆕 新規追加コントラクト
- **YMT**: YMT.sol（非UUPS）
- **veYMT**: veYMT.sol（非UUPS）
- **YmtVesting**: YmtVesting.sol（非UUPS）
- **YmtMinter**: YmtMinter.sol
- **ScoreWeightController**: ScoreWeightController.sol
- **ScoreRegistry**: ScoreRegistry.sol

### 🔄 アップグレード
- **Yamato**: YamatoV3.sol → YamatoV4.sol
- **CurrencyOS**: CurrencyOSV2.sol → CurrencyOSV3.sol
- **YamatoDepositor**: YamatoDepositorV2.sol → YamatoDepositorV3.sol
- **YamatoBorrower**: YamatoBorrower.sol → YamatoBorrowerV2.sol
- **YamatoRepayer**: YamatoRepayerV2.sol → YamatoRepayerV3.sol
- **YamatoWithdrawer**: YamatoWithdrawerV2.sol → YamatoWithdrawerV3.sol
- **YamatoRedeemer**: YamatoRedeemerV4.sol → YamatoRedeemerV5.sol
- **YamatoSweeper**: YamatoSweeperV2.sol → YamatoSweeperV3.sol
- **FeePool**: FeePool.sol → FeePoolV2.sol

### 変更なし
- PriceFeed, Pool, PriorityRegistry, PledgeLib

---

## Yamato v2.0（マルチカレンシー対応）

### 🆕 新規追加コントラクト
- **YmtOS**: YmtOS.sol
- **CUSD**: CUSD.sol（非UUPS）
- **CEUR**: CEUR.sol（非UUPS）
- **PriceFeedSingle**: PriceFeedSingle.sol

### 🔄 アップグレード
- **CurrencyOS**: CurrencyOSV3.sol → CurrencyOSV4.sol
- **ScoreWeightController**: ScoreWeightController.sol → ScoreWeightControllerV2.sol

### 🔁 通貨別デプロイ（CUSD/CEUR用）
各通貨ごとに以下のコントラクトを新規デプロイ：
- Yamato (YamatoV4.sol)
- CurrencyOS (CurrencyOSV4.sol)
- YamatoDepositor (YamatoDepositorV3.sol)
- YamatoBorrower (YamatoBorrowerV2.sol)
- YamatoRepayer (YamatoRepayerV3.sol)
- YamatoWithdrawer (YamatoWithdrawerV3.sol)
- YamatoRedeemer (YamatoRedeemerV5.sol)
- YamatoSweeper (YamatoSweeperV3.sol)
- Pool (PoolV2.sol)
- PriorityRegistry (PriorityRegistryV6.sol)
- ScoreRegistry (ScoreRegistry.sol)
- PriceFeed (PriceFeedV3.sol または PriceFeedSingle.sol)

---

## バージョン比較表

| コントラクト名 | v1.0 | v1.5 | v2.0 CJPY | v2.0 CUSD | v2.0 CEUR |
|--------------|------|------|-----------|-----------|-----------|
| **Yamato** | V3 | V4 | V4 | V4（新規） | V4（新規） |
| **CurrencyOS** | V2 | V3 | V4 | V4（新規） | V4（新規） |
| **YamatoDepositor** | V2 | V3 | V3 | V3（新規） | V3（新規） |
| **YamatoBorrower** | V1 | V2 | V2 | V2（新規） | V2（新規） |
| **YamatoRepayer** | V2 | V3 | V3 | V3（新規） | V3（新規） |
| **YamatoWithdrawer** | V2 | V3 | V3 | V3（新規） | V3（新規） |
| **YamatoRedeemer** | V4 | V5 | V5 | V5（新規） | V5（新規） |
| **YamatoSweeper** | V2 | V3 | V3 | V3（新規） | V3（新規） |
| **FeePool** | V1 | V2 | V2 | V2 | V2 |
| **PriceFeed** | V3 | V3 | V3 | Single V1 | V3 |
| **Pool** | V2 | V2 | V2 | V2（新規） | V2（新規） |
| **PriorityRegistry** | V6 | V6 | V6 | V6（新規） | V6（新規） |
| **ScoreWeightController** | - | V1 | V2 | V2 | V2 |
| **ScoreRegistry** | - | V1 | V1 | V1（新規） | V1（新規） |
| **YmtMinter** | - | V1 | V1 | V1 | V1 |
| **YMT** | - | ✓ | ✓ | ✓ | ✓ |
| **veYMT** | - | ✓ | ✓ | ✓ | ✓ |
| **YmtVesting** | - | ✓ | ✓ | ✓ | ✓ |
| **YmtOS** | - | - | ✓ | ✓ | ✓ |
| **CJPY** | ✓ | ✓ | ✓ | - | - |
| **CUSD** | - | - | - | ✓ | - |
| **CEUR** | - | - | - | - | ✓ |
| **PledgeLib** | ✓ | ✓ | ✓ | ✓ | ✓ |

### 凡例
- **VX**: バージョン番号
- **✓**: 非UUPSコントラクト（バージョン番号なし）
- **-**: 未デプロイ
- **（新規）**: そのバージョンで新規デプロイされたインスタンス

---

## 注意事項

1. **非UUPSコントラクト**（アップグレード不可）
   - CJPY, CUSD, CEUR
   - YMT, veYMT, YmtVesting

2. **マルチカレンシー対応（v2.0）**
   - CUSD、CEURは独立したYamatoインスタンスを持つ
   - YmtOSで統合管理

3. **共有コントラクト**
   - YMT, veYMT, YmtVesting, YmtMinter, ScoreWeightController, FeePool, PledgeLib
   - これらは全通貨で共有

4. **通貨別コントラクト**
   - Yamato, CurrencyOS, 各Action, Pool, PriorityRegistry, ScoreRegistry
   - 各通貨ごとに独立したインスタンスを持つ
