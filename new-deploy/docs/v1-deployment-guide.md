# Yamato v1.0 デプロイガイド

このドキュメントは、Yamato v1.0の完全なデプロイと初期設定の手順をまとめたものです。

---

## 📋 デプロイ対象コントラクト

### コアコントラクト (UUPS)
1. **PriceFeed** - PriceFeedV3.sol
2. **FeePool** - FeePool.sol
3. **CurrencyOS** - CurrencyOSV2.sol
4. **Yamato** - YamatoV3.sol

### 通貨トークン (非UUPS)
5. **CJPY** - CJPY.sol

### アクションコントラクト (UUPS)
6. **YamatoDepositor** - YamatoDepositorV2.sol
7. **YamatoBorrower** - YamatoBorrower.sol
8. **YamatoRepayer** - YamatoRepayerV2.sol
9. **YamatoWithdrawer** - YamatoWithdrawerV2.sol
10. **YamatoRedeemer** - YamatoRedeemerV4.sol
11. **YamatoSweeper** - YamatoSweeperV2.sol

### サポートコントラクト (UUPS)
12. **Pool** - PoolV2.sol
13. **PriorityRegistry** - PriorityRegistryV6.sol

---

## 🚀 クイックスタート

### 1. 前提条件

```bash
# 1. Anvilを起動（別ターミナル）
cd /Users/ryu/dev/yamato
anvil

# 2. コントラクトをコンパイル
npx hardhat compile

# 3. デプロイディレクトリに移動
cd new-deploy
```

### 2. 一括デプロイ

```bash
# 全コントラクトを一括デプロイ
npx tsx scripts/deploy/v1/deploy-all.ts --network=localhost
```

**所要時間:** 約30〜60秒

### 3. 初期設定

```bash
# 初期設定を一括実行
npx tsx scripts/setup/v1/setup-all.ts --network=localhost
```

**所要時間:** 約10〜15秒

### 4. 完了！

デプロイされたコントラクトのアドレスは以下に保存されます：
```
deployments/localhost/
```

---

## 📝 個別実行

### 個別デプロイ

```bash
# 基盤コントラクト
npx tsx scripts/deploy/v1/deploy-pricefeed.ts --network=localhost
npx tsx scripts/deploy/v1/deploy-cjpy.ts --network=localhost
npx tsx scripts/deploy/v1/deploy-feepool.ts --network=localhost

# コアコントラクト
npx tsx scripts/deploy/v1/deploy-currencyos.ts --network=localhost
npx tsx scripts/deploy/v1/deploy-yamato.ts --network=localhost

# アクションコントラクト
npx tsx scripts/deploy/v1/deploy-yamato-depositor.ts --network=localhost
npx tsx scripts/deploy/v1/deploy-yamato-borrower.ts --network=localhost
npx tsx scripts/deploy/v1/deploy-yamato-repayer.ts --network=localhost
npx tsx scripts/deploy/v1/deploy-yamato-withdrawer.ts --network=localhost
npx tsx scripts/deploy/v1/deploy-yamato-redeemer.ts --network=localhost
npx tsx scripts/deploy/v1/deploy-yamato-sweeper.ts --network=localhost

# サポートコントラクト
npx tsx scripts/deploy/v1/deploy-pool.ts --network=localhost
npx tsx scripts/deploy/v1/deploy-priority-registry.ts --network=localhost
```

### 個別設定

```bash
# Yamato依存関係の登録
npx tsx scripts/setup/v1/setup-yamato-deps.ts --network=localhost

# CurrencyOSにYamatoを追加
npx tsx scripts/setup/v1/setup-currencyos-add-yamato.ts --network=localhost

# CJPY設定とガバナンス放棄
npx tsx scripts/setup/v1/setup-cjpy.ts --network=localhost
```

---

## 🔍 初期設定の詳細

### 1. Yamato.setDeps()

**目的:** Yamatoに全ての依存コントラクトを登録

**登録されるコントラクト:**
- YamatoDepositor
- YamatoBorrower
- YamatoRepayer
- YamatoWithdrawer
- YamatoRedeemer
- YamatoSweeper
- Pool
- PriorityRegistry

### 2. CurrencyOS.addYamato()

**目的:** CurrencyOSにYamatoインスタンスを登録

**パラメータ:**
- Yamatoプロキシアドレス

**Gas Limit:** 2,000,000

### 3. CJPY.setCurrencyOS() + revokeGovernance()

**目的:** CJPYにCurrencyOSを設定し、ガバナンス権限を放棄

**実行内容:**
1. `CJPY.setCurrencyOS(CurrencyOSアドレス)`
2. `CJPY.revokeGovernance()`

**注意:** この2つの操作は連続して実行されます。

---

## 🌐 本番環境デプロイ

### Sepoliaテストネット

```bash
# 1. .envファイルを設定
# SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/YOUR_KEY
# PRIVATE_KEY=0x...

# 2. デプロイ
npx tsx scripts/deploy/v1/deploy-all.ts --network=sepolia

# 3. 初期設定
npx tsx scripts/setup/v1/setup-all.ts --network=sepolia
```

### Mainnet

```bash
# デプロイ
npx tsx scripts/deploy/v1/deploy-all.ts --network=mainnet

# 初期設定
npx tsx scripts/setup/v1/setup-all.ts --network=mainnet
```

---

## ✅ デプロイ後の確認

### アドレスファイルの確認

```bash
ls -la deployments/localhost/
```

**保存されるファイル:**
- `PriceFeedERC1967Proxy`
- `PriceFeedUUPSImpl`
- `CJPY`
- `FeePoolERC1967Proxy`
- `FeePoolUUPSImpl`
- `CurrencyOSERC1967Proxy`
- `CurrencyOSUUPSImpl`
- `YamatoERC1967Proxy`
- `YamatoUUPSImpl`
- (各アクションコントラクトのProxyとImpl)
- `PoolERC1967Proxy`
- `PoolUUPSImpl`
- `PriorityRegistryERC1967Proxy`
- `PriorityRegistryUUPSImpl`

---

## 🔧 トラブルシューティング

### "Address file not found" エラー

**原因:** 依存コントラクトがデプロイされていない

**解決策:** 依存コントラクトを先にデプロイしてください

```bash
# 例: Yamatoデプロイ前に必要
npx tsx scripts/deploy/v1/deploy-currencyos.ts --network=localhost
```

### "invalid chain id for signer" エラー

**原因:** Anvilが起動していないか、チェーンIDが一致していない

**解決策:**
```bash
# 1. Anvilが起動しているか確認
ps aux | grep anvil

# 2. Anvilを再起動
pkill -f anvil
anvil

# 3. .envファイルを確認
# LOCALHOST_CHAIN_ID=31337
```

### "Failed to load artifact" エラー

**原因:** コントラクトがコンパイルされていない

**解決策:**
```bash
cd /Users/ryu/dev/yamato
npx hardhat compile
cd new-deploy
```

---

## 📊 デプロイ統計

**総コントラクト数:** 13

**UUPS プロキシ:** 12
**非UUPS:** 1 (CJPY)

**総デプロイ時間（目安）:**
- ローカル: ~60秒
- Sepolia: ~5分
- Mainnet: ~10分

**総Gas使用量（目安）:**
- ローカル: 無制限
- Sepolia: ~50M gas
- Mainnet: ~50M gas

---

## 📚 参考資料

- [contract-versions.md](../../doc/deploy/contract-versions.md) - コントラクトバージョン情報
- [setup-functions.md](../../doc/deploy/setup-functions.md) - 初期設定関数の詳細
- [new-deployment-plan.md](../../doc/deploy/new-deployment-plan.md) - デプロイ戦略
- [README.md](../README.md) - プロジェクト概要

---

## 🎯 次のステップ

v1.0のデプロイが完了したら：

1. **v1.5へのアップグレード** - YMTトークンシステムの追加
2. **v2.0へのアップグレード** - マルチカレンシー対応（CUSD/CEUR）

詳細は各バージョンのドキュメントを参照してください。

