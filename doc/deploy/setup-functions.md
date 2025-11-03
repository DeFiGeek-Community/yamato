# Yamato デプロイ後の初期設定手順

このドキュメントは、コントラクトデプロイ時の初期化引数とデプロイ後に実行する必要がある初期設定関数をまとめたものです。

---

## デプロイ時の初期化引数

### v1.0 デプロイ時の `initialize` 引数

各UUPS proxyコントラクトのデプロイ時に`initialize`関数を呼び出す際の引数です。

| コントラクト | 実装バージョン | 初期化関数 | 引数 |
|------------|-------------|-----------|-----|
| **PriceFeed** | PriceFeedV3 | `initialize` | `_ethPriceAggregatorInUSDAddress` (Chainlink ETH/USD Oracle)<br/>`_jpyPriceAggregatorInUSDAddress` (Chainlink JPY/USD Oracle) |
| **FeePool** | FeePool | `initialize` | なし |
| **CurrencyOS** | CurrencyOSV2 | `initialize` | `currencyAddr` (CJPYアドレス)<br/>`feedAddr` (PriceFeed プロキシアドレス)<br/>`feePoolAddr` (FeePool プロキシアドレス) |
| **Yamato** | YamatoV3 | `initialize` | `_currencyOS` (CurrencyOS プロキシアドレス) |
| **YamatoDepositor** | YamatoDepositorV2 | `initialize` | `_yamato` (Yamato プロキシアドレス) |
| **YamatoBorrower** | YamatoBorrower | `initialize` | `_yamato` (Yamato プロキシアドレス) |
| **YamatoRepayer** | YamatoRepayerV2 | `initialize` | `_yamato` (Yamato プロキシアドレス) |
| **YamatoWithdrawer** | YamatoWithdrawerV2 | `initialize` | `_yamato` (Yamato プロキシアドレス) |
| **YamatoRedeemer** | YamatoRedeemerV4 | `initialize` | `_yamato` (Yamato プロキシアドレス) |
| **YamatoSweeper** | YamatoSweeperV2 | `initialize` | `_yamato` (Yamato プロキシアドレス) |
| **Pool** | PoolV2 | `initialize` | `_yamato` (Yamato プロキシアドレス) |
| **PriorityRegistry** | PriorityRegistryV6 | `initialize` | `_yamato` (Yamato プロキシアドレス) |

**注意事項:**
- **CJPY**: 通常のERC20コントラクト（非proxy）のため、コンストラクタで初期化されます。
- **Chainlinkアドレス**: 本番環境では実際のChainlink Aggregatorアドレスを使用します。テスト環境ではモックアドレスを使用します。
- **依存関係**: 初期化引数に他のコントラクトアドレスが必要なため、デプロイ順序が重要です。

### v1.0 デプロイ順序

依存関係に基づいた正しいデプロイ順序：

```
1. PriceFeed (PriceFeedV3)
   ↓
2. CJPY (CurrencyV2) - 非proxy
   ↓
3. FeePool (FeePool)
   ↓
4. CurrencyOS (CurrencyOSV2) - CJPY, PriceFeed, FeePoolが必要
   ↓
5. Yamato (YamatoV3) - CurrencyOSが必要
   ↓
6. YamatoDepositor (YamatoDepositorV2) - Yamatoが必要
   ↓
7. YamatoBorrower (YamatoBorrower) - Yamatoが必要
   ↓
8. YamatoRepayer (YamatoRepayerV2) - Yamatoが必要
   ↓
9. YamatoWithdrawer (YamatoWithdrawerV2) - Yamatoが必要
   ↓
10. YamatoRedeemer (YamatoRedeemerV4) - Yamatoが必要
   ↓
11. YamatoSweeper (YamatoSweeperV2) - Yamatoが必要
   ↓
12. Pool (PoolV2) - Yamatoが必要
   ↓
13. PriorityRegistry (PriorityRegistryV6) - Yamatoが必要
```

**デプロイ完了後、初期設定を実行します（次のセクション参照）。**

---

## v1.0 初期設定

### 1. Yamato依存関係の設定
**関数**: `Yamato.setDeps()`

**実行タイミング**: 全コントラクトデプロイ後

**パラメータ**:
- YamatoDepositor プロキシアドレス
- YamatoBorrower プロキシアドレス
- YamatoRepayer プロキシアドレス
- YamatoWithdrawer プロキシアドレス
- YamatoRedeemer プロキシアドレス
- YamatoSweeper プロキシアドレス
- Pool プロキシアドレス
- PriorityRegistry プロキシアドレス

**説明**: Yamatoメインコントラクトに全てのアクションコントラクトとサポートコントラクトのアドレスを登録します。

---

### 2. CurrencyOSにYamatoを追加
**関数**: `CurrencyOS.addYamato()`

**実行タイミング**: Yamato依存関係設定後

**パラメータ**:
- Yamato プロキシアドレス

**説明**: CurrencyOSにYamatoインスタンスを登録します。

---

### 3. CJPYにCurrencyOSを設定とガバナンス権限の放棄
**関数**: `CJPY.setCurrencyOS()` + `CJPY.revokeGovernance()`

**実行タイミング**: CurrencyOS.addYamato()実行後

**パラメータ**:
- CurrencyOS プロキシアドレス

**説明**: CJPYトークンにCurrencyOSのアドレスを設定し、ガバナンス権限を放棄します。この2つの処理は同一スクリプト内で連続実行されます。

---

### 4. テスターモードの無効化（本番環境のみ）
**関数**: 
- `Yamato.revokeTester()`
- `YamatoDepositor.revokeTester()`
- `YamatoBorrower.revokeTester()`
- `YamatoRepayer.revokeTester()`
- `YamatoWithdrawer.revokeTester()`
- `YamatoRedeemer.revokeTester()`
- `YamatoSweeper.revokeTester()`

**実行タイミング**: 本番デプロイの最終段階

**パラメータ**: なし

**説明**: テストモード用のアドレスを削除し、本番環境として確定します。

---

## v1.5 初期設定（YMT追加）

### 前提: v1.0コントラクトのアップグレード

v1.5では、まず既存のv1.0コントラクトを新しいバージョンにアップグレードする必要があります。

#### アップグレード対象コントラクト

| コントラクト | v1.0 → v1.5 |
|------------|-------------|
| YamatoRepayer | V2 → V3 |
| YamatoRedeemer | V4 → V5 |
| YamatoWithdrawer | V2 → V3 |
| YamatoSweeper | V2 → V3 |
| YamatoDepositor | V2 → V3 |
| YamatoBorrower | V1 → V2 |
| CurrencyOS | V2 → V3 |
| Yamato | V3 → V4 |
| FeePool | V1 → V2 |

#### アップグレード手順

1. **新しい実装コントラクトをデプロイ**
   - 各コントラクトの新バージョン実装をデプロイ
   - ライブラリリンクが必要なコントラクトはPledgeLibをリンク

2. **プロキシをアップグレード**
   - **通常のコントラクト（8個）**: `upgradeTo(newImplAddress)`を実行
   - **FeePool**: `upgradeToAndCall(newImplAddress, initData)`を実行
     - `initData`は`initializeV2(startTime)`のエンコード
     - `startTime`: FeePool配布開始時刻（UNIX timestamp）
     - 例: `1753412400` (2025-05-24 00:00:00 UTC)

3. **アップグレード後の初期設定**
   - `Yamato.setScoreRegistry()` - ScoreRegistryアドレスを設定
   - `FeePool.setVeYMT()` - veYMTアドレスを設定
   - `CurrencyOS.setYMT()` - YMTアドレスを設定
   - `CurrencyOS.setVeYMT()` - veYMTアドレスを設定
   - `CurrencyOS.setYmtMinter()` - YmtMinterアドレスを設定
   - `CurrencyOS.setScoreWeightController()` - ScoreWeightControllerアドレスを設定
   - `FeePool.toggleAllowCheckpointToken()` - チェックポイント機能を有効化

---

### 1. YmtVestingにYMTトークンを設定
**関数**: `YmtVesting.setYmtToken()`

**実行タイミング**: YMTデプロイ後

**パラメータ**:
- YMT アドレス

**説明**: YmtVestingコントラクトにYMTトークンのアドレスを登録します。

---

### 2. YMTにMinterを設定
**関数**: `YMT.setMinter()`

**実行タイミング**: YmtMinterデプロイ後

**パラメータ**:
- YmtMinter プロキシアドレス

**説明**: YMTトークンにMinter権限を持つコントラクトを設定します。

---

### 3. ScoreWeightControllerにScoreRegistryを追加
**関数**: `ScoreWeightController.addScore()`

**実行タイミング**: ScoreRegistryデプロイ後

**パラメータ**:
- ScoreRegistry プロキシアドレス
- ウェイト（例: 1 ether）

**説明**: ScoreWeightControllerにScoreRegistryを登録し、ウェイトを設定します。

---

## v2.0 初期設定（マルチカレンシー）

### CUSD/CEUR共通の設定手順

#### 1. Yamato依存関係の設定
**関数**: `Yamato.setDeps()`（v1.0と同じ）

**実行タイミング**: 各通貨のYamatoデプロイ後

**パラメータ**: v1.0と同じ（通貨別のアドレス）

---

#### 2. CurrencyOSにYamatoを追加
**関数**: `CurrencyOS.addYamato()`（v1.0と同じ）

**実行タイミング**: Yamato依存関係設定後

**パラメータ**: 各通貨のYamato プロキシアドレス

---

#### 3. CurrencyOSにYmtOSを設定
**関数**: `CurrencyOS.setYmtOS()`

**実行タイミング**: YmtOSデプロイ後、CurrencyOS.addYamato()実行後

**パラメータ**:
- YmtOS プロキシアドレス

**説明**: 各通貨のCurrencyOSにYmtOS（統合管理システム）を設定します。

---

#### 4. 通貨トークンにCurrencyOSを設定
**関数**: 
- `CUSD.setCurrencyOS()` + `CUSD.revokeGovernance()` または
- `CEUR.setCurrencyOS()` + `CEUR.revokeGovernance()`

**実行タイミング**: CurrencyOS.setYmtOS()実行後

**パラメータ**:
- CurrencyOS プロキシアドレス（通貨別）

**説明**: 各通貨トークンにCurrencyOSを設定し、ガバナンス権限を放棄します。この2つの処理は同一スクリプト内で連続実行されます。

---

#### 5. YmtOSにCurrencyOSを追加
**関数**: `YmtOS.addCurrencyOS()`

**実行タイミング**: 通貨トークン.setCurrencyOS()実行後

**パラメータ**:
- CurrencyOS プロキシアドレス（通貨別）

**説明**: YmtOSに各通貨のCurrencyOSを登録します。

---

#### 6. YamatoにScoreRegistryを設定
**関数**: `Yamato.setScoreRegistry()`

**実行タイミング**: ScoreRegistryデプロイ後

**パラメータ**:
- ScoreRegistry プロキシアドレス（通貨別）

**説明**: 各通貨のYamatoにScoreRegistryを設定します。

---

## 実行順序まとめ

### v1.0

```
1. デプロイ: PriceFeed, CJPY, FeePool, CurrencyOS, Yamato, Actions, Pool, PriorityRegistry
   ↓
2. Yamato.setDeps()
   ↓
3. CurrencyOS.addYamato()
   ↓
4. CJPY.setCurrencyOS() + CJPY.revokeGovernance()（同時実行）
   ↓
5. (本番のみ) *.revokeTester()
```

### v1.5（v1.0に追加）

```
1. デプロイ: YmtVesting, YMT, veYMT, ScoreWeightController, YmtMinter, ScoreRegistry
   ↓
2. アップグレード手順:
   a. 新しい実装コントラクトをデプロイ
      (YamatoRepayerV3, YamatoRedeemerV5, YamatoWithdrawerV3, YamatoSweeperV3,
       YamatoDepositorV3, YamatoBorrowerV2, CurrencyOSV3, YamatoV4, FeePoolV2)
   ↓
   b. 各プロキシをアップグレード (upgradeTo)
   ↓
   c. アップグレード後の初期設定
      - Yamato.setScoreRegistry()
      - FeePool.setVeYMT()
      - CurrencyOS.setYMT()
      - CurrencyOS.setVeYMT()
      - CurrencyOS.setYmtMinter()
      - CurrencyOS.setScoreWeightController()
      - FeePool.toggleAllowCheckpointToken()
   ↓
3. YmtVesting.setYmtToken()
   ↓
4. YMT.setMinter()
   ↓
5. ScoreWeightController.addScore()
```

### v2.0（通貨ごと）

#### CUSD
```
1. デプロイ: YmtOS
   ↓
2. デプロイ: PriceFeedSingle(USD), CUSD, CurrencyOS(CUSD), Yamato(CUSD), 
            Actions(CUSD), Pool(CUSD), PriorityRegistry(CUSD)
   ↓
3. Yamato(CUSD).setDeps()
   ↓
4. CurrencyOS(CUSD).addYamato()
   ↓
5. CurrencyOS(CUSD).setYmtOS()
   ↓
6. CUSD.setCurrencyOS() + CUSD.revokeGovernance()（同時実行）
   ↓
7. YmtOS.addCurrencyOS(CUSD)
   ↓
8. デプロイ: ScoreRegistry(CUSD)
   ↓
9. Yamato(CUSD).setScoreRegistry()
   ↓
10. アップグレード: ScoreWeightController v1→v2
```

#### CEUR（CUSDと並列または順次）
```
1. デプロイ: PriceFeedV3(EUR), CEUR, CurrencyOS(CEUR), Yamato(CEUR),
            Actions(CEUR), Pool(CEUR), PriorityRegistry(CEUR)
   ↓
2. Yamato(CEUR).setDeps()
   ↓
3. CurrencyOS(CEUR).addYamato()
   ↓
4. CurrencyOS(CEUR).setYmtOS()
   ↓
5. CEUR.setCurrencyOS() + CEUR.revokeGovernance()（同時実行）
   ↓
6. デプロイ: ScoreRegistry(CEUR)
   ↓
7. Yamato(CEUR).setScoreRegistry()
```

---

## 環境変数

### v2.0で必要な環境変数

```bash
# 対象通貨の指定（CUSD または CEUR）
CURRENCY=CUSD
```

v2.0のスクリプトは`CURRENCY`環境変数を参照して、対応する通貨のアドレスを読み込みます。

---

## 注意事項

1. **実行順序**
   - 依存関係があるため、必ず記載された順序で実行してください

2. **アドレス確認**
   - 各関数実行前に、必要なコントラクトがデプロイ済みであることを確認してください
   - `deployments/<network>/`ディレクトリにアドレスファイルが存在することを確認

3. **Gas制限**
   - 一部の関数（例: `addYamato()`, `setYmtOS()`）は`gasLimit: 2000000`を指定しています
   - ネットワークの状況により調整が必要な場合があります

4. **べき等性**
   - 既存のスクリプトは、設定済みかどうかをチェックしてからスキップする仕組みがあります
   - 再実行しても安全です

5. **本番環境**
   - `revokeTester()`は本番環境でのみ実行してください
   - テスト環境では実行しないでください

6. **マルチカレンシー**
   - v2.0では`CURRENCY`環境変数を正しく設定してから実行してください
   - CUSD/CEURで別々に実行する必要があります

