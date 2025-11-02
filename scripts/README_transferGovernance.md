# Transfer Governance Script

このスクリプトは`executeTransactionWithFoundation`を使用して、すべてのコントラクトのガバナンスをマルチシグアドレスに移譲します。

## 使用方法

### 1. 環境変数の設定

`.env`ファイルに以下の環境変数を設定してください：

```bash
# マルチシグアドレス
UUPS_PROXY_ADMIN_MULTISIG_ADDRESS=0x...

# Foundationの秘密鍵
FOUNDATION_PRIVATE_KEY=0x...

# ネットワーク
NETWORK=localhost  # または mainnet, sepolia など

# RPC URL (localhost以外の場合)
ALCHEMY_URL=https://...
```

### 2. スクリプトの実行

```bash
# TypeScriptで直接実行
npx ts-node scripts/transferGovernanceWithFoundation.ts

# または、package.jsonにスクリプトを追加して実行
npm run transfer-governance
```

## 対象コントラクト

以下のコントラクトのガバナンスが移譲されます：

- PriceFeed
- FeePool
- CurrencyOS
- Pool
- PriorityRegistry
- Yamato
- YamatoDepositor
- YamatoBorrower
- YamatoRepayer
- YamatoWithdrawer
- YamatoRedeemer
- YamatoSweeper

## 注意事項

- このスクリプトは`FOUNDATION_PRIVATE_KEY`を使用してトランザクションを実行します
- 各コントラクトの`setGovernance`メソッドを呼び出します
- エラーが発生した場合、そのコントラクトはスキップされ、他のコントラクトの処理は続行されます
- トランザクションのハッシュとステータスが表示されます

## トラブルシューティング

### よくあるエラー

1. **"FOUNDATION_PRIVATE_KEY is not defined in .env"**
   - `.env`ファイルに`FOUNDATION_PRIVATE_KEY`を設定してください

2. **"UUPS_PROXY_ADMIN_MULTISIG_ADDRESS is not defined in .env"**
   - `.env`ファイルに`UUPS_PROXY_ADMIN_MULTISIG_ADDRESS`を設定してください

3. **"ALCHEMY_URL is not set"**
   - localhost以外のネットワークを使用する場合、`.env`ファイルに`ALCHEMY_URL`を設定してください

4. **コントラクトアドレスが見つからない**
   - デプロイメントファイルが存在することを確認してください
   - 正しいネットワークが設定されていることを確認してください
