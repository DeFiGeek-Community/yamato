# YMT Token

## 概要

YMT Token は、piecewise-linear mining supply を持つ ERC20 トークンです。このトークンのサプライは線形に増加しており、マイニングパラメータは定期的に更新される。初期供給は一定であり、その後の供給レートは時間の経過とともに減少していく。

---

## 定数

### `YEAR: constant(uint256) = 86400 * 365`

- **説明**: 1 年の秒数を表す定数。具体的には、1 日の秒数（86400 秒）に 365 を掛けた値。

### `INITIAL_SUPPLY: constant(uint256) `

- **説明**: トークンの初期供給量。

### `INITIAL_RATE: constant(uint256)`

- **説明**: 初期のマイニングレート。

### `RATE_REDUCTION_TIME: constant(uint256) = YEAR`

- **説明**: マイニングレートが減少する時間の間隔。

### `RATE_REDUCTION_COEFFICIENT: constant(uint256)`

- **説明**: マイニングレートの減少係数。

### `RATE_DENOMINATOR: constant(uint256) = 10 ** 18`

- **説明**: レートの分母として使用される定数。

### `INFLATION_DELAY: constant(uint256) = 86400`

- **説明**: インフレーションが適用されるまでの遅延時間（秒）。

---

## 変数

### `name: public(String[64])`

- **説明**: トークンの名前。

### `symbol: public(String[32])`

- **説明**: トークンのシンボル。

### `decimals: public(uint256)`

- **説明**: トークンの小数点以下の桁数。

### `balanceOf: public(HashMap[address, uint256])`

- **説明**: 各アドレスのトークン残高を保持するマップ。

### `allowances: HashMap[address, HashMap[address, uint256]]`

- **説明**: トークンの所有者が他のユーザーに許可したトークンの移動量。

### `total_supply: uint256`

- **説明**: 現在のトークンの総供給量。

### `minter: public(address)`

- **説明**: トークンを mint できるアドレス。

### `admin: public(address)`

- **説明**: このスマートコントラクトの管理者アドレス。

### `mining_epoch: public(int128)`

- **説明**: 現在のマイニングエポック。

### `start_epoch_time: public(uint256)`

- **説明**: 現在のエポックの開始タイムスタンプ。

### `rate: public(uint256)`

- **説明**: 現在のマイニングレート。

### `start_epoch_supply: uint256`

- **説明**: エポック開始時の供給量。

---

## イベント

### Transfer:

- \_from: indexed(address)
- \_to: indexed(address)
- \_value: uint256

### Approval:

- \_owner: indexed(address)
- \_spender: indexed(address)
- \_value: uint256

### UpdateMiningParameters:

- time: uint256
- rate: uint256
- supply: uint256

### SetMinter:

- minter: address

### SetAdmin:

- admin: address

---

## 関数

### `__init__(_name: String[64], _symbol: String[32], _decimals: uint256)`

- **説明**：コントラクトのコンストラクタ。初期設定を行います。
- **パラメータ**：
  - `_name`：トークンの名前。
  - `_symbol`：トークンのシンボル。
  - `_decimals`：トークンの小数点以下の桁数。

### `_update_mining_parameters()`

- **説明**：採掘のレートと供給をエポックの開始時に更新します。
- **制限**：内部関数。

### `update_mining_parameters()`

- **説明**：エポックの開始時に採掘のレートと供給を更新します。

### `start_epoch_time_write() -> uint256`

- **説明**：現在の採掘エポックの開始タイムスタンプを取得し、同時に採掘パラメータを更新します。

### `future_epoch_time_write() -> uint256`

- **説明**：次の採掘エポックの開始タイムスタンプを取得し、同時に採掘パラメータを更新します。

### `_available_supply() -> uint256`

- **説明**：存在するトークンの数（請求済みまたは未請求）を返します。
- **制限**：内部関数。

### `available_supply() -> uint256`

- **説明**：存在するトークンの数（請求済みまたは未請求）を返します。

### `mintable_in_timeframe(start: uint256, end: uint256) -> uint256`

- **説明**：指定されたタイムフレームで発行可能なトークンの量を計算します。
- **パラメータ**：
  - `start`：タイムフレームの開始タイムスタンプ。
  - `end`：タイムフレームの終了タイムスタンプ。

### `set_minter(_minter: address)`

- **説明**：minter のアドレスを設定します。
- **パラメータ**：
  - `_minter`：minter のアドレス。

### `set_admin(_admin: address)`

- **説明**：新しい管理者のアドレスを設定します。
- **パラメータ**：
  - `_admin`：新しい管理者のアドレス。

### `totalSupply() -> uint256`

- **説明**：存在するトークンの総量を返します。

### `allowance(_owner: address, _spender: address) -> uint256`

- **説明**：\_owner が\_spender に許可したトークンの量を返します。
- **パラメータ**：
  - `_owner`：資金の所有者のアドレス。
  - `_spender`：資金を使うアドレス。

### `transfer(_to: address, _value: uint256) -> bool`

- **説明**：`msg.sender`から`_to`へのトークンの転送。
- **パラメータ**：
  - `_to`：受取人のアドレス。
  - `_value`：転送するトークンの量。

### `transferFrom(_from: address, _to: address, _value: uint256) -> bool`

- **説明**：`_from`から`_to`へのトークンの転送。
- **パラメータ**：
  - `_from`：送信者のアドレス。
  - `_to`：受取人のアドレス。
  - `_value`：転送するトークンの量。

### `approve(_spender: address, _value: uint256) -> bool`

- **説明**：`msg.sender`が`_spender`にトークンを使わせ
