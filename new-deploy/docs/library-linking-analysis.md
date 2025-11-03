# PledgeLib ライブラリリンク要否の調査結果

## 📊 調査方法

各コントラクトのコンパイル済みアーティファクトの`linkReferences`フィールドを確認。

```bash
cat artifacts/contracts/<Contract>.sol/<Contract>.json | jq -r '.linkReferences'
```

## ✅ v1.0 コントラクト

| コントラクト | linkReferences | リンク必要 | 実装 |
|------------|---------------|----------|------|
| YamatoBorrower | PledgeLib参照あり | ✅ 必要 | ✅ 正しい |
| YamatoRepayerV2 | `{}` (空) | ❌ 不要 | ✅ 正しい |
| YamatoWithdrawerV2 | PledgeLib参照あり | ✅ 必要 | ✅ 正しい |
| YamatoRedeemerV4 | PledgeLib参照あり | ✅ 必要 | ✅ 正しい |
| YamatoSweeperV2 | PledgeLib参照あり | ✅ 必要 | ✅ 正しい |
| **YamatoDepositorV2** | `{}` (空) | **❌ 不要** | ✅ 正しい |

## ✅ v1.5 アップグレード対象コントラクト

| コントラクト | linkReferences | リンク必要 | 実装 | 備考 |
|------------|---------------|----------|------|------|
| YamatoBorrowerV2 | PledgeLib参照あり | ✅ 必要 | ✅ 正しい | |
| YamatoRepayerV3 | PledgeLib参照あり | ✅ 必要 | ✅ 正しい | |
| YamatoWithdrawerV3 | PledgeLib参照あり | ✅ 必要 | ✅ 正しい | |
| YamatoRedeemerV5 | PledgeLib参照あり | ✅ 必要 | ✅ 正しい | |
| YamatoSweeperV3 | PledgeLib参照あり | ✅ 必要 | ✅ 正しい | |
| **YamatoDepositorV3** | PledgeLib参照あり | **✅ 必要** | ✅ 正しい | **V2→V3で変更** |
| YamatoV4 | `{}` (空) | ❌ 不要 | ✅ 正しい | |
| CurrencyOSV3 | `{}` (空) | ❌ 不要 | ✅ 正しい | |
| FeePoolV2 | `{}` (空) | ❌ 不要 | ✅ 正しい | |
| PriorityRegistryV6 | PledgeLib参照あり | ✅ 必要 | ✅ 正しい | |
| PoolV2 | `{}` (空) | ❌ 不要 | - | v1.0のみ |

## 🔍 重要な発見

### 1. `using PledgeLib`宣言とlinkReferencesは別物

- **`using PledgeLib for ...`**: Solidityの構文糖衣（syntax sugar）
- **`linkReferences`**: 実際のバイトコードでの外部ライブラリ参照

コントラクトが`using PledgeLib`を宣言していても、実際にライブラリ関数を呼び出していない場合、コンパイラは最適化によってlinkReferencesを生成しない。

### 2. YamatoDepositorのバージョン間の違い

- **YamatoDepositorV2**: `using PledgeLib`宣言はあるが、実際には使用していない → linkReferences = `{}`
- **YamatoDepositorV3**: PledgeLibの関数を実際に呼び出している → linkReferences にPledgeLib参照あり

### 3. hardhat-viemの動作

`hardhat-viem`の`deployContract`は、linkReferencesを自動的に検証し：
- linkReferencesが空の場合: ライブラリ指定があるとエラー (`UnnecessaryLibraryLinkError`)
- linkReferencesがあるのにライブラリ未指定: エラー (`MissingLibraryAddressError`)

これにより、誤ったライブラリリンク設定を防ぐことができる。

## 📝 旧フロー（Hardhat Deploy）との違い

旧フロー（`deploy/009_deploy_yamatoActions.ts`）では、全てのアクションコントラクトに対して一律で`["PledgeLib"]`を指定していた：

```typescript
await getLinkedProxy<T, S>(
  `Yamato${actionName}`,
  [_yamatoAddr],
  ["PledgeLib"],  // 全てのアクションに指定
  versionSpecification
);
```

しかし、実際には：
- `getLinkedContractFactory`内で`linkBytecode`が実行される
- linkReferencesが空の場合、リンク処理はスキップされる
- 結果的に、不要なコントラクトにライブラリを指定しても問題なかった

新フロー（hardhat-viem）では、より厳密にチェックされるため、正確な設定が必要。

## ✅ 結論

現在の実装は、各コントラクトのlinkReferencesの実態に基づいて正しく設定されている。

**v1.0デプロイ:**
- YamatoBorrower: ライブラリリンクあり ✅
- YamatoWithdrawer: ライブラリリンクあり ✅
- YamatoRedeemer: ライブラリリンクあり ✅
- YamatoSweeper: ライブラリリンクあり ✅
- YamatoDepositor: ライブラリリンクなし ✅
- YamatoRepayer: ライブラリリンクなし ✅

**v1.5アップグレード:**
- 6つのアクションコントラクト: 全てライブラリリンクあり ✅
- CurrencyOSV3, YamatoV4, FeePoolV2: ライブラリリンクなし ✅

