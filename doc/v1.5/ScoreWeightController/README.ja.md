# Score Weight Controller

## 概要

Score Weight Controller は、流動性スコアを管理し、これらのスコアを通じてトークンの発行を制御するコントラクトです。

---

## イベント

### `NewScore`:

- **説明**: 新しいスコアが追加されたときにトリガーされるイベント。
- **パラメータ**:
  - `addr`: スコアのアドレス。
  - `weight`: スコアの重み。

---

## 変数

### `nScores: public(int128)`

- **説明**: スコアの総数。

### `scores: public(mapping(address => int128))`

- **説明**: アドレスに関連付けられたスコアのマッピング。

---

## 関数

### `initialize(ymtAddr: address, veYmtAddr: address)`

- **説明**: コントラクトの初期化関数。YMT トークンと veYMT コントラクトのアドレスを設定します。
- **パラメータ**:
  - `ymtAddr`: YMT トークンのアドレス。
  - `veYmtAddr`: veYMT コントラクトのアドレス。

### `addScore(addr_: address, weight_: uint256)`

- **説明**: 指定されたアドレスのスコアを追加し、その重みを設定します。
- **パラメータ**:
  - `addr_`: スコアのアドレス。
  - `weight_`: スコアの重み。
- **アクセス制限**: 管理者のみ。

### `checkpoint()`

- **説明**: すべてのスコアに共通のデータを記録するためのチェックポイント関数。(V2.0 で実装予定)

### `checkpointScore(addr_: address)`

- **説明**: 特定のスコアおよびすべてのスコアに共通のデータを記録するためのチェックポイント関数。(V2.0 で実装予定)
- **パラメータ**:
  - `addr_`: スコアのアドレス。

### `scoreRelativeWeight(addr_: address, time_: uint256)`

- **説明**: 指定されたスコアの相対重みを取得します。(V2.0 で実装予定。V1.5 では一定の値を返します。)
- **パラメータ**:
  - `addr_`: スコアのアドレス。
  - `time_`: 相対重みを計算するための時刻。

### `changeScoreWeight(addr_: address, weight_: uint256)`

- **説明**: 指定されたスコアの重みを変更します。(V2.0 で実装予定)
- **パラメータ**:
  - `addr_`: スコアのアドレス。
  - `weight_`: 新しいスコアの重み。
- **アクセス制限**: 管理者のみ。

### `YMT()`

- **説明**: YMT トークンのアドレスを返します。

### `veYMT()`

- **説明**: veYMT コントラクトのアドレスを返します。
