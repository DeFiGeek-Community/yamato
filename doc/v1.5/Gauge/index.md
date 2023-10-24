# Gauge

## 概要

Gaugeは、Yamato Protocolによって提供される報酬ゲージを計算・保存するコントラクトです。

---

## 定数

### `VERSION: constant(String[8]) = "v1"`
- **説明**: コントラクトのバージョン情報。

### `MAX_REWARDS`
- **説明**: 同時に追跡できる報酬の最大数。現在は8です。

### `TOKENLESS_PRODUCTION`
- **説明**: トークンなしでの生産可能な最大値。現在の値は40です。

### `WEEK`
- **説明**: 1週間の秒数。現在の値は604800秒です。

### 各アドレス定数 (`MINTER`, `YMT`, `veYMT`)
- **説明**: 特定の役割を持つ外部コントラクトのアドレスを定義しています。

---

## 変数

### `NAME`
- **説明**: ゲージの名前。

### `TOKEN_ADDRESS`
- **説明**: 対象となるトークンのアドレス。

### `nonces`
- **説明**: 各アドレスのnonceのマッピング。

### `future_epoch_time`
- **説明**: 未来のエポック時間。

### `balanceOf`
- **説明**: 各アドレスのバランスのマッピング。

### `totalSupply`
- **説明**: 合計供給量。

### `working_balances`
- **説明**: 各アドレスの動作中のバランス。

### `working_supply`
- **説明**: 動作中の供給量。

### `reward_count`, `reward_tokens`, `reward_data`
- **説明**: 外部報酬の追跡のための変数。

### `rewards_receiver`
- **説明**: 請求者からデフォルトの報酬受取人へのマッピング。

### `reward_integral_for`
- **説明**: 報酬トークンに関する請求アドレスの積分のマッピング。

### `claim_data`
- **説明**: ユーザーに関する請求データのマッピング。

### `admin`, `future_admin`, `is_killed`
- **説明**: 管理者関連の変数。

### `integrate_inv_supply_of`, `integrate_checkpoint_of`, `integrate_fraction`
- **説明**: 供給や報酬に関する積分の計算のための変数。

### `inflation_rate`
- **説明**: インフレ率。

### `period`, `period_timestamp`, `integrate_inv_supply`
- **説明**: インフレ率の変化や供給の積分に関する変数。

---

## イベント

### `UpdateLimit`
- **説明**: ユーザーの情報が更新された際に発火。
- 各変数はユーザーの情報や更新後の情報を示します。

### その他のイベント（`CommitOwnership`, `ApplyOwnership`）
- **説明**: 各イベントはゲージの管理やトークンの移転、許可の変更に関連する操作を示します。

---

## 関数

### `__init__(_lp_token: address, _admin: address)`
- **説明**: コントラクトの初期化関数。初期設定を行います。
- **パラメータ**:
  - `_lp_token`: 流動性プールトークンのアドレス。
  - `_admin`: 管理者のアドレス。

### `integrate_checkpoint() -> uint256`
- **説明**: 現在の期間のタイムスタンプを取得する関数。

### `_update_liquidity_limit(addr: address, l: uint256, L: uint256)`
- **説明**: ユーザーの流動性の限界を更新する内部関数。CRVトークンの量に基づいてワーキングバランスを計算します。
- **パラメータ**:
  - `addr`: ユーザーのアドレス。
  - `l`: ユーザーの流動性の量。
  - `L`: 全体の流動性の量。

### `user_checkpoint(addr: address) -> bool`
- **説明**: ユーザー`addr`のチェックポイントを記録します。
- **パラメータ**:
  - `addr`: チェックポイントを記録するユーザーのアドレス。

### `claimable_tokens(addr: address) -> uint256`
- **説明**: チェックポイントを更新して、ユーザー`addr`に対して請求可能なトークンの数を取得します。
- **パラメータ**:
  - `addr`: 請求可能なトークンの数を取得するユーザーのアドレス。

### `claimed_reward(_addr: address, _token: address) -> uint256`
- **説明**: ユーザー`_addr`が既に請求した報酬トークンの数を取得します。
- **パラメータ**:
  - `_addr`: 既に請求した報酬トークンの数を取得するユーザーのアドレス。
  - `_token`: 既に請求した報酬トークンのアドレス。

### `claimable_reward(_user: address, _reward_token: address) -> uint256`
- **説明**: ユーザー`_user`に対して請求可能な報酬トークンの数を取得します。
- **パラメータ**:
  - `_user`: 請求可能な報酬トークンの数を取得するユーザーのアドレス。
  - `_reward_token`: 請求可能な報酬トークンのアドレス。

### `set_rewards_receiver(_receiver: address)`
- **説明**: 呼び出し元のデフォルトの報酬受信者を設定します。
- **パラメータ**:
  - `_receiver`: `claim_rewards`で報酬を受け取るアドレス。

### `claim_rewards(_addr: address = msg.sender, _receiver: address = ZERO_ADDRESS)`
- **説明**: `_addr`の利用可能な報酬トークンを請求します。
- **パラメータ**:
  - `_addr`: 報酬を請求するアドレス。
  - `_receiver`: 報酬を転送するアドレス。ZERO_ADDRESSに設定されている場合、呼び出し元のデフォルトの報酬受信者を使用します。

### `kick(addr: address)`
- **説明**: そのブーストを乱用している`addr`をキックします。
- **パラメータ**:
  - `addr`: キックするアドレス。

### `set_killed(_is_killed: bool)`
- **説明**: このコントラクトの`killed`ステータスを設定します。`killed`としてマークされた場合、このゲージは常にレート0を返すため、CRVを生成することはできません。
- **パラメータ**:
  - `_is_killed`: 設定する`killed`のステータス。

### `commit_transfer_ownership(addr: address)`
- **説明**: `Gauge`の所有権を`addr`に転送します。
- **パラメータ**:
  - `addr`: 所有権を転送するアドレス。

### `accept_transfer_ownership()`
- **説明**: 所有権転送を受け入れます。

### `version() -> String[8]`
- **説明**: このゲージのバージョンを取得します。


