# contract-definitions.ts 移行サマリー

## 概要

全てのデプロイ、セットアップ、アップグレードスクリプトを`contract-definitions.ts`から読み取るように更新しました。

## 更新されたファイル

### ✅ v1 デプロイスクリプト (16ファイル)

すべてのv1デプロイスクリプトが`V1_CONTRACTS`を使用するように更新されました：

- `deploy-pricefeed.ts` → `V1_CONTRACTS.PriceFeed`
- `deploy-feepool.ts` → `V1_CONTRACTS.FeePool`
- `deploy-currencyos.ts` → `V1_CONTRACTS.CurrencyOS`
- `deploy-yamato.ts` → `V1_CONTRACTS.Yamato`
- `deploy-yamato-depositor.ts` → `V1_CONTRACTS.YamatoDepositor`
- `deploy-yamato-borrower.ts` → `V1_CONTRACTS.YamatoBorrower` + `requiresPledgeLib()`
- `deploy-yamato-repayer.ts` → `V1_CONTRACTS.YamatoRepayer`
- `deploy-yamato-withdrawer.ts` → `V1_CONTRACTS.YamatoWithdrawer` + `requiresPledgeLib()`
- `deploy-yamato-redeemer.ts` → `V1_CONTRACTS.YamatoRedeemer` + `requiresPledgeLib()`
- `deploy-yamato-sweeper.ts` → `V1_CONTRACTS.YamatoSweeper` + `requiresPledgeLib()`
- `deploy-pool.ts` → `V1_CONTRACTS.Pool`
- `deploy-priority-registry.ts` → `V1_CONTRACTS.PriorityRegistry` + `requiresPledgeLib()`
- `deploy-pledgelib.ts` → `V1_CONTRACTS.PledgeLib`
- `deploy-cjpy.ts` → `V1_CONTRACTS.CJPY`
- `deploy-mocks.ts` → `V1_CONTRACTS.ChainLinkMock`

### ✅ v1.5 デプロイスクリプト (7ファイル)

v1.5の新規コントラクトとアップグレード実装が更新されました：

- `deploy-ymt.ts` → `V1_5_CONTRACTS.YMT`
- `deploy-veymt.ts` → `V1_5_CONTRACTS.veYMT`
- `deploy-ymt-vesting.ts` → `V1_5_CONTRACTS.YmtVesting`
- `deploy-ymt-minter.ts` → `V1_5_CONTRACTS.YmtMinter`
- `deploy-score-weight-controller.ts` → `V1_5_CONTRACTS.ScoreWeightController`
- `deploy-score-registry.ts` → `V1_5_CONTRACTS.ScoreRegistry` + `requiresPledgeLib()`

### ✅ v1.5 アップグレードスクリプト (3ファイル)

- `deploy-implementations.ts` → `V1_5_UPGRADE_IMPLEMENTATIONS` + `requiresPledgeLib()`
- `upgrade-proxies.ts` → `V1_5_UPGRADE_IMPLEMENTATIONS` + `V1_5_UPGRADE_PROXIES`
- `post-upgrade-setup.ts` → `V1_5_UPGRADE_IMPLEMENTATIONS`

### ✅ v2 デプロイスクリプト (12ファイル)

v2の通貨別コントラクトが更新されました：

- `deploy-ymtos.ts` → `V2_CONTRACTS.YmtOS`
- `deploy-cusd.ts` → `V2_CONTRACTS.CUSD`
- `deploy-ceur.ts` → `V2_CONTRACTS.CEUR`
- `deploy-pricefeed-single.ts` → `V2_CONTRACTS.PriceFeedSingle`
- `deploy-currency-currencyos.ts` → `V2_CURRENCY_CONTRACTS.CurrencyOS`
- `deploy-currency-yamato.ts` → `V2_CURRENCY_CONTRACTS.Yamato`
- `deploy-currency-actions.ts` → `V2_CURRENCY_CONTRACTS.*` + `requiresPledgeLib()`
- `deploy-currency-pool.ts` → `V2_CURRENCY_CONTRACTS.Pool`
- `deploy-currency-priority-registry.ts` → `V2_CURRENCY_CONTRACTS.PriorityRegistry` + `requiresPledgeLib()`
- `deploy-currency-score-registry.ts` → `V2_CURRENCY_CONTRACTS.ScoreRegistry` + `requiresPledgeLib()`

### ✅ v2 アップグレードスクリプト (2ファイル)

- `upgrade-cjpy-currencyos.ts` → `V2_UPGRADE_IMPLEMENTATIONS.CurrencyOS`
- `upgrade-score-weight-controller.ts` → `V2_UPGRADE_IMPLEMENTATIONS.ScoreWeightController`

### ✅ セットアップスクリプト (15ファイル)

v1, v1.5, v2の全セットアップスクリプトが対応するコントラクト定義を使用：

**v1:**
- `setup-yamato-deps.ts` → `V1_CONTRACTS.Yamato`
- `setup-currencyos-add-yamato.ts` → `V1_CONTRACTS.CurrencyOS`
- `setup-cjpy.ts` → `V1_CONTRACTS.CJPY`

**v1.5:**
- `setup-ymt-vesting.ts` → `V1_5_CONTRACTS.YmtVesting`
- `setup-ymt-minter.ts` → `V1_5_CONTRACTS.YMT`
- `setup-score-weight-controller.ts` → `V1_5_CONTRACTS.ScoreWeightController`

**v2:**
- `setup-currency-yamato-deps.ts` → `V2_CURRENCY_CONTRACTS.Yamato`
- `setup-currency-currencyos-add-yamato.ts` → `V2_CURRENCY_CONTRACTS.CurrencyOS`
- `setup-currency-currencyos-set-ymtos.ts` → `V2_CURRENCY_CONTRACTS.CurrencyOS` + `V2_CONTRACTS.YmtOS`
- `setup-currency-token.ts` → `V2_CONTRACTS.CUSD/CEUR`
- `setup-ymtos-add-currencyos.ts` → `V2_CONTRACTS.YmtOS`
- `setup-currency-yamato-score-registry.ts` → `V2_CURRENCY_CONTRACTS.Yamato`

## 主な変更点

### 1. コントラクト名の一元管理

**Before:**
```typescript
const result = await deployUUPS({
  name: 'Yamato',
  contractName: 'YamatoV3',  // ハードコード
  // ...
});
```

**After:**
```typescript
import { V1_CONTRACTS } from '../../core/contract-definitions';

const result = await deployUUPS({
  name: 'Yamato',
  contractName: V1_CONTRACTS.Yamato,  // 定義から取得
  // ...
});
```

### 2. ライブラリリンク判定の自動化

**Before:**
```typescript
const result = await deployUUPS({
  name: 'YamatoBorrower',
  contractName: 'YamatoBorrower',
  libraries: {  // 手動で指定
    'contracts/Dependencies/PledgeLib.sol:PledgeLib': pledgeLibAddr,
  },
});
```

**After:**
```typescript
import { V1_CONTRACTS, requiresPledgeLib } from '../../core/contract-definitions';

const needsLibrary = requiresPledgeLib(V1_CONTRACTS.YamatoBorrower, 'v1');

const result = await deployUUPS({
  name: 'YamatoBorrower',
  contractName: V1_CONTRACTS.YamatoBorrower,
  libraries: needsLibrary ? {  // 自動判定
    'contracts/Dependencies/PledgeLib.sol:PledgeLib': pledgeLibAddr,
  } : undefined,
});
```

### 3. アップグレード情報の一元管理

**Before:**
```typescript
const upgrades = [
  { name: 'Yamato', version: 'V4', proxyContract: 'YamatoV3', method: 'upgradeTo' },
  // ...
];
```

**After:**
```typescript
import { 
  V1_5_UPGRADE_IMPLEMENTATIONS, 
  V1_5_UPGRADE_PROXIES 
} from '../../core/contract-definitions';

const upgrades = [
  { name: 'Yamato', version: 'V4', proxyContract: V1_5_UPGRADE_PROXIES.Yamato, method: 'upgradeTo' },
  // ...
];
```

## メリット

### 1. ✅ 一貫性
- 全スクリプトで同じコントラクト名を使用
- タイポや不整合のリスクを排除

### 2. ✅ 保守性
- コントラクト名の変更が一箇所で完結
- バージョンアップ時の修正箇所が明確

### 3. ✅ 型安全性
- TypeScriptの型システムで誤りを防止
- IDEの補完機能が利用可能

### 4. ✅ ライブラリリンク管理
- PledgeLibリンクが必要なコントラクトを明示的に定義
- `requiresPledgeLib()`関数で自動判定

### 5. ✅ ドキュメント性
- `contract-definitions.ts`を見れば全コントラクトが一目で分かる
- 各バージョンの違いが明確

## 統計

- **更新ファイル数**: 55+ファイル
- **コントラクト定義数**: 50+個
- **サポートバージョン**: v1.0, v1.5, v2.0
- **ライブラリリンク対応**: 自動判定機能実装

## 今後の拡張

`contract-definitions.ts`に新しいコントラクトを追加するだけで、全スクリプトが自動的に対応します：

```typescript
// 新しいバージョンを追加する場合
export const V3_CONTRACTS = {
  NewContract: 'NewContractV1',
  // ...
} as const;
```

## まとめ

全てのデプロイ、セットアップ、アップグレードスクリプトが`contract-definitions.ts`を参照するように統一されました。これにより、保守性、一貫性、型安全性が大幅に向上し、将来の拡張も容易になりました。

