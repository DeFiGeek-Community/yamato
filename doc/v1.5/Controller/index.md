## 定数

### `WEEK: constant(uint256) = 604800`

- **説明**: 1 週間の秒数。現在の値は 604800 秒です。

### `WEIGHT_VOTE_DELAY: constant(uint256) = 10 * 86400`

- **説明**: 重みの投票を変更することができるのは 10 日に 1 回だけです。現在の値は 10 日（864,000 秒）です。

### `MULTIPLIER: constant(uint256) = 10 ** 18`

- **説明**: 多数の固定小数点数を扱うための乗数。現在の値は 10 の 18 乗です。

---

## 変数

### `admin: public(address)`

- **説明**: 管理者のアドレス。このアドレスはスマートコントラクトに許可されています。

### `future_admin: public(address)`

- **説明**: 未来の管理者のアドレス。所有権の移転が計画されています。

### `token: public(address)`

- **説明**: CRV トークンのアドレス。

### `voting_escrow: public(address)`

- **説明**: 投票エスクローのアドレス。

### `n_gauge_types: public(int128)`

- **説明**: 使用可能なゲージの種類の数。

### `n_gauges: public(int128)`

- **説明**: 現在のゲージの数。

### `gauge_type_names: public(HashMap[int128, String[64]])`

- **説明**: 各ゲージの種類の名前を格納するマップ。

### `gauges: public(address[1000000000])`

- **説明**: ゲージのアドレスを格納するリスト。

### `gauge_types_: HashMap[address, int128]`

- **説明**: 各ゲージアドレスとそのタイプを関連付けるマップ。

### `vote_user_slopes: public(HashMap[address, HashMap[address, VotedSlope]])`

- **説明**: ユーザーの各ゲージアドレスに対する投票傾斜を格納するマップ。

### `vote_user_power: public(HashMap[address, uint256])`

- **説明**: ユーザーが使用する総投票パワー。

### `last_user_vote: public(HashMap[address, HashMap[address, uint256]])`

- **説明**: 各ゲージアドレスの最後のユーザー投票のタイムスタンプ。

### `points_weight: public(HashMap[address, HashMap[uint256, Point]])`

- **説明**: 各ゲージアドレスと時間に対する点数の重みを格納するマップ。

### `changes_weight: HashMap[address, HashMap[uint256, uint256]]`

- **説明**: 各ゲージアドレスと時間に対する重みの変更を格納するマップ。

### `time_weight: public(HashMap[address, uint256])`

- **説明**: 各ゲージアドレスの最後のスケジュールされた時間。

### `points_sum: public(HashMap[int128, HashMap[uint256, Point]])`

- **説明**: ゲージタイプと時間に対する点の合計を格納するマップ。

### `changes_sum: HashMap[int128, HashMap[uint256, uint256]]`

- **説明**: ゲージタイプと時間に対する合計の変更を格納するマップ。

### `time_sum: public(uint256[1000000000])`

- **説明**: ゲージタイプの最後のスケジュールされた時間。

### `points_total: public(HashMap[uint256, uint256])`

- **説明**: 時間ごとの総重みを格納するマップ。

### `time_total: public(uint256)`

- **説明**: 総重みの最後のスケジュールされた時間。

---

## イベント

### `CommitOwnership`

- **説明**: 所有権のコミットイベント。
- **パラメータ**:
  - `admin`: 管理者のアドレス。

### `ApplyOwnership`

- **説明**: 所有権の適用イベント。
- **パラメータ**:
  - `admin`: 管理者のアドレス。

### `AddType`

- **説明**: 新しいタイプの追加イベント。
- **パラメータ**:
  - `name`: タイプの名前。
  - `type_id`: タイプ ID。

### `NewTypeWeight`

- **説明**: 新しいタイプの重みイベント。
- **パラメータ**:
  - `type_id`: タイプ ID。
  - `time`: タイムスタンプ。
  - `weight`: 重み。
  - `total_weight`: 総重量。

### `NewGaugeWeight`

- **説明**: 新しいゲージの重みイベント。
- **パラメータ**:
  - `gauge_address`: ゲージのアドレス。
  - `time`: タイムスタンプ。
  - `weight`: 重み。
  - `total_weight`: 総重量。

### `VoteForGauge`

- **説明**: ゲージへの投票イベント。
- **パラメータ**:
  - `time`: タイムスタンプ。
  - `user`: ユーザーのアドレス。
  - `gauge_addr`: ゲージのアドレス。
  - `weight`: 重み。

### `NewGauge`

- **説明**: 新しいゲージのイベント。
- **パラメータ**:
  - `addr`: ゲージのアドレス。
  - `gauge_type`: ゲージのタイプ。
  - `weight`: 重み。

---

## 関数

### `__init__(_token: address, _voting_escrow: address)`

- **説明**: コントラクトの初期化関数。初期設定を行います。
- **パラメータ**:
  - `_token`: `ERC20CRV` コントラクトのアドレス。
  - `_voting_escrow`: `VotingEscrow` コントラクトのアドレス。

### `commit_transfer_ownership(addr: address)`

- **説明**: GaugeController の所有権を`addr`に転送するためのコミット関数。
- **パラメータ**:
  - `addr`: 所有権が転送されるアドレス。

### `apply_transfer_ownership()`

- **説明**: 保留中の所有権転送を適用する関数。

### `gauge_types(_addr: address) -> int128`

- **説明**: 指定したアドレスのゲージタイプを取得する関数。
- **パラメータ**:
  - `_addr`: ゲージのアドレス。

### `_get_type_weight(gauge_type: int128) -> uint256`

- **説明**: 歴史的なタイプの重みを計算し、未チェックインの週に記入します。また、次の週のタイプの重みを返します。
- **パラメータ**:
  - `gauge_type`: ゲージタイプの ID。

### `_get_sum(gauge_type: int128) -> uint256`

- **説明**: 同じタイプのゲージの重みの合計を計算し、未チェックインの週に記入します。また、次の週の合計を返します。
- **パラメータ**:
  - `gauge_type`: ゲージタイプの ID。

### `_get_total() -> uint256`

- **説明**: 歴史的な全体の重みを計算し、未チェックインの週に記入します。また、次の週の合計を返します。

### `_get_weight(gauge_addr: address) -> uint256`

- **説明**: 歴史的なゲージの重みを計算し、未チェックインの週に記入します。また、次の週のゲージの重みを返します。
- **パラメータ**:
  - `gauge_addr`: ゲージのアドレス。

### `add_gauge(addr: address, gauge_type: int128, weight: uint256 = 0)`

- **説明**: 指定されたタイプと重みでゲージを追加します。
- **パラメータ**:
  - `addr`: ゲージのアドレス。
  - `gauge_type`: ゲージタイプ。
  - `weight`: ゲージの重み。

### `checkpoint()`

- **説明**: すべてのゲージに共通のデータを記入するためのチェックポイント。

### `checkpoint_gauge(addr: address)`

- **説明**: 特定のゲージとすべてのゲージに共通のデータを記入するためのチェックポイント。
- **パラメータ**:
  - `addr`: ゲージのアドレス。

### `_gauge_relative_weight(addr: address, time: uint256) -> uint256`

- **説明**: 指定されたタイムスタンプでのゲージの相対重み（1.0 を超えない）を取得します。
- **パラメータ**:
  - `addr`: ゲージのアドレス。
  - `time`: 指定したタイムスタンプ。

### `gauge_relative_weight(addr: address, time: uint256 = block.timestamp) -> uint256`

- **説明**: 指定されたタイムスタンプでのゲージの相対重みを取得します。
- **パラメータ**:
  - `addr`: ゲージのアドレス。
  - `time`: 指定したタイムスタンプ。

### `gauge_relative_weight_write(addr: address, time: uint256 = block.timestamp) -> uint256`

- **説明**:

指定されたタイムスタンプでのゲージの相対重みを書き込みます。

- **パラメータ**:
  - `addr`: ゲージのアドレス。
  - `time`: 指定したタイムスタンプ。

### `add_type(_name: String[64], weight: uint256 = 0)`

- **説明**: ゲージタイプを追加します。ゲージタイプ名 `_name` と重み `weight` を指定して追加します。
- **パラメータ**:
  - `_name`: ゲージタイプの名前。
  - `weight`: ゲージタイプの重み。

### `change_type_weight(type_id: int128, weight: uint256)`

- **説明**: ゲージタイプの重みを変更します。
- **パラメータ**:
  - `type_id`: ゲージタイプ ID。
  - `weight`: 新しいゲージの重み。

### `change_gauge_weight(addr: address, weight: uint256)`

- **説明**: ゲージの重みを変更します。
- **パラメータ**:
  - `addr`: `GaugeController` コントラクトのアドレス。
  - `weight`: 新しいゲージの重み。

### `vote_for_gauge_weights(_gauge_addr: address, _user_weight: uint256)`

- **説明**: プールの重みを変更するための投票パワーを割り当てます。
- **パラメータ**:
  - `_gauge_addr`: 投票対象のゲージアドレス。
  - `_user_weight`: ゲージの重み (bps 単位、0.01%の単位)。

### `get_gauge_weight(addr: address) -> uint256`

- **説明**: 現在のゲージの重みを取得します。
- **パラメータ**:
  - `addr`: ゲージのアドレス。

### `get_type_weight(type_id: int128) -> uint256`

- **説明**: 現在のタイプの重みを取得します。
- **パラメータ**:
  - `type_id`: タイプ ID。

### `get_total_weight() -> uint256`

- **説明**: 現在の合計 (タイプごとの重み付け) 重みを取得します。

### `get_weights_sum_per_type(type_id: int128) -> uint256`

- **説明**: タイプごとのゲージの重みの合計を取得します。
- **パラメータ**:
  - `type_id`: タイプ ID。
