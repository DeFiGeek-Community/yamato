# Score Registry

## 概要

`ScoreRegistry` コントラクトは、Yamato Protocol の一部として、ユーザーの作業バランス（スコアリミット）を計算し、YMT トークンの適切な配分を実現するために使用されます。この計算は、ユーザーの担保比率と総借入額に基づいて行われます。

---

## イベント

### `UpdateScoreLimit`:

- **説明**: ユーザーのスコア制限が更新されたときにトリガーされるイベント。
- **パラメータ**:
  - `user`: ユーザーのアドレス。
  - `originalBalance`: 元のバランス。
  - `originalSupply`: 元の供給量。
  - `collateralRatio`: 担保比率。
  - `workingBalance`: 労働バランス。
  - `workingSupply`: 労働供給。

---

## 変数

### `isKilled: public(bool)`

- **説明**: コントラクトが停止されているかどうかを示すフラグ。

### `futureEpochTime: public(uint256)`

- **説明**: 次のエポックの開始時刻。

### `inflationRate: public(uint256)`

- **説明**: インフレーション率。

### `workingBalances: public(mapping(address => uint256))`

- **説明**: 各アドレスの労働バランス。

### `workingSupply: public(uint256)`

- **説明**: 総労働供給量。

### `integrateFraction: public(mapping(address => uint256))`

- **説明**: ユーザーごとの積分値。

---

## 関数

### `initialize(ymtMinterAddr: address, yamatoAddr: address)`

- **説明**: コントラクトを初期化します。
- **パラメータ**:
  - `ymtMinterAddr`: YMT ミンターのアドレス。
  - `yamatoAddr`: Yamato コントラクトのアドレス。

### `checkpoint(addr: address)`

- **説明**: 指定されたアドレスのチェックポイントを更新します。
- **パラメータ**:
  - `addr`: 更新するアドレス。
- **アクセス制限**: Yamato の関連コントラクトのみ。

### `updateScoreLimit(addr_: address, debt_: uint256, totalDebt_: uint256, collateralRatio_: uint256)`

- **説明**: ユーザーのスコアを更新します。
- **パラメータ**:
  - `addr_`: ユーザーのアドレス。
  - `debt_`: ユーザーの借金額。
  - `totalDebt_`: システムの総借金額。
  - `collateralRatio_`: 担保比率。
- **アクセス制限**: Yamato の関連コントラクトのみ。

### `userCheckpoint(addr_: address)`

- **説明**: ユーザーのチェックポイントとスコアを更新します。
- **パラメータ**:
  - `addr_`: ユーザーのアドレス。

### `kick(addr_: address)`

- **説明**: ユーザーをキックし、スコア制限をリセットします。
- **パラメータ**:
  - `addr_`: キックするユーザーのアドレス。

### `setKilled(isKilled_: bool)`

- **説明**: コントラクトの停止状態を設定します。管理者のみ実行可能。
- **パラメータ**:
  - `isKilled_`: 停止状態。
- **アクセス制限**: 管理者のみ。

### `integrateCheckpoint()`

- **説明**: 最後のチェックポイントのタイムスタンプを取得します。

---

## コントラクト詳細

### スコア計算式

ユーザーの作業バランスは以下の式によって計算されます:

$$
\text{workingSupply} = \min\left( \text{自債務}, \left( \text{自債務} \times 0.4 \right) + \left( 0.6 \times \frac{\text{総債務} \times \text{自veYMT}}{\text{総veYMT}} \right) \right) / \text{担保係数}
$$

ここで、

- **自債務**: ユーザーの CJPY 借入額。
- **総債務**: システム全体の CJPY 総借入額。
- **自 veYMT**: ユーザーの veYMT トークンのバランス。
- **総 veYMT**: veYMT トークンの総供給量。
- **担保係数**: ユーザーの担保比率に基づく係数。250%以上で 2.5、200%以上で 2.0、150%以上で 1.5、130%以上で 1.0、それ以外は 0。

この計算により、ユーザーが YMT トークンの配分を受け取る際の基準となる`workingSupply`(作業バランス)が決定されます。

### 積分計算の説明

`integrateInvSupply` は、特定の期間にわたって計算される積分値です。具体的には以下の式で表されます：

$$ \text{integrateInvSupply} = \int\_{\text{開始時刻}}^{\text{終了時刻}} \frac{\text{rate}(t) \times \text{weight}(t)}{\text{workingSupply}(t)} \, dt $$

ここで、

- t は時間を表します。
- weight(t) は時間 t における ScoreRegistry の相対的な重み。
- rate(t) は時間 t におけるマイニングレートです。
- workingSupply(t) は時間 t におけるシステム全体の作業バランスの総和です。

この積分は、特定の期間（通常は週単位）にわたって計算され、新たな `integrateInvSupply` の値は、その期間にわたる平均マイニングレートと作業供給の比率を反映します。
