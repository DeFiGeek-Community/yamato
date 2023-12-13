# Fee Pool V2

## 概要

Fee Pool V2 は、手数料プールの管理と手数料の分配を行うコントラクトです。veYMT（投票エスクロー YMT）トークンの所有者に対して、プール内のトークンを分配します。

---

## イベント

### `ToggleAllowCheckpointToken`:

- **説明**: トークンのチェックポイント許可が切り替えられたときにトリガーされるイベント。
- **パラメータ**:
  - `toggleFlag`: 切り替えのフラグ。

### `CheckpointToken`:

- **説明**: トークンのチェックポイントが更新されたときにトリガーされるイベント。
- **パラメータ**:
  - `time`: チェックポイントのタイムスタンプ。
  - `tokens`: 分配されたトークンの量。

### `Claimed`:

- **説明**: 手数料が請求されたときにトリガーされるイベント。
- **パラメータ**:
  - `recipient`: 受取人のアドレス。
  - `amount`: 請求された手数料の量。
  - `claimEpoch`: 請求されたエポック。
  - `maxEpoch`: 最大エポック。

### `Received`:

- **説明**: トークンがコントラクトに送られたときにトリガーされるイベント。
- **パラメータ**:
  - `sender`: 送信者のアドレス。
  - `value`: 送信されたトークンの量。

### `VeYMTSet`:

- **説明**: veYMT のアドレスが設定されたときにトリガーされるイベント。
- **パラメータ**:
  - `sender`: 設定を行ったアドレス。
  - `veYMT`: veYMT のアドレス。

---

## 変数

### `startTime: public(uint256)`

- **説明**: 手数料分配の開始時間。

### `timeCursor: public(uint256)`

- **説明**: 現在の時間カーソル。

### `lastTokenTime: public(uint256)`

- **説明**: 最後のトークン時間。

### `tokensPerWeek: public(mapping(uint256 => uint256))`

- **説明**: 週ごとのトークン分配量。

### `tokenLastBalance: public(uint256)`

- **説明**: 最後のトークン残高。

### `veSupply: public(mapping(uint256 => uint256))`

- **説明**: 週ごとの veYMT の総供給量。

### `canCheckpointToken: public(bool)`

- **説明**: トークンのチェックポイントを任意のアカウントが行えるかどうかのフラグ。

### `isKilled: public(bool)`

- **説明**: コントラクトが停止されたかどうかを示すフラグ。

---

## 関数

### `initialize(startTime_: uint256)`

- **説明**: コントラクトの初期化を行います。
- **パラメータ**:
  - `startTime_`: 手数料分配の開始時間。

### `checkpointToken()`

- **説明**: トークンのチェックポイントを更新します。

### `claim()`

- **説明**: `msg.sender`の手数料を請求します。

### `claim(addr_: address)`

- **説明**: 指定されたアドレスの手数料を請求します。
- **パラメータ**:
  - `addr_`: 請求するアドレス。

### `claimMany(receivers_: address[])`

- **説明**: 複数のアドレスの手数料を一括で請求します。
- **パラメータ**:
  - `receivers_`: 請求するアドレスの配列。

### `toggleAllowCheckpointToken()`

- **説明**: トークンのチェックポイント許可を切り替えます。

### `killMe()`

- **説明**: コントラクトを停止し、残高をガバナンスアドレスに送ります。

### `recoverBalance()`

- **説明**: コントラクトからネイティブトークンを回収します。

### `setVeYMT(_veymt: address)`

- **説明**: veYMT のアドレスを設定します。
- **パラメータ**:
  - `_veymt`: veYMT のアドレス。
