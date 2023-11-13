# Token Minter

## 概要

Token Minter は、特定のゲージからトークンを mint するためのコントラクトです。YMT トークンを mint する機能を提供します。また、ユーザーが他のユーザーに代わって mint する権限を与えることもできます。

---

## インターフェース

### `Gauge`:

- **説明**: 流動性のゲージから情報を取得するためのインターフェース。
- **関数**:
  - `integrate_fraction(addr: address) -> uint256`: 指定したアドレスの積分値を取得する。
  - `user_checkpoint(addr: address) -> bool`: ユーザーチェックポイントを更新する。

### `YMT`:

- **説明**: トークンを mint するための ERC20 トークンインターフェース。
- **関数**:
  - `mint(_to: address, _value: uint256) -> bool`: トークンを mint する。

---

## イベント

### `Minted`:

- **説明**: トークンが mint されたときにトリガーされるイベント。
- **パラメータ**:
  - `recipient`: 受取人のアドレス。
  - `gauge`: 使用されたゲージのアドレス。
  - `minted`: mint されたトークンの量。

---

## 変数

### `token: public(address)`

- **説明**: mint する MERC20 トークンのアドレス。

### `minted: public(HashMap[address, HashMap[address, uint256]])`

- **説明**: すでに mint されたトークンの量を追跡するためのマップ。

### `allowed_to_mint_for: public(HashMap[address, HashMap[address, bool]])`

- **説明**: あるユーザーが別のユーザーに代わってトークンを mint することを許可するためのマップ。

---

## 関数

### `__init__(_token: address, _controller: address)`

- **説明**: コントラクトの初期化関数。トークンとコントローラーのアドレスを設定する。
- **パラメータ**:
  - `_token`: MERC20 トークンのアドレス。
  - `_controller`: GaugeController のアドレス。

### `_mint_for(gauge_addr: address, _for: address)`

- **説明**: 内部関数。指定したゲージからトークンを mint する。
- **パラメータ**:
  - `gauge_addr`: ゲージのアドレス。
  - `_for`: トークンを受け取るアドレス。

### `mint(gauge_addr: address)`

- **説明**: `msg.sender`に属するすべてのトークンを mint して送信する。
- **パラメータ**:
  - `gauge_addr`: ゲージのアドレス。

### `mint_many(gauge_addrs: address[8])`

- **説明**: 複数のゲージから`msg.sender`に属するすべてのトークンを mint する。
- **パラメータ**:
  - `gauge_addrs`: ゲージのアドレスのリスト。

### `mint_for(gauge_addr: address, _for: address)`

- **説明**: `_for`のためのトークンを mint する。`msg.sender`が承認されている場合のみ可能。
- **パラメータ**:
  - `gauge_addr`: ゲージのアドレス。
  - `_for`: トークンを受け取るアドレス。

### `toggle_approve_mint(minting_user: address)`

- **説明**: `minting_user`が`msg.sender`の代わりにトークンを mint することを許可または禁止する。
- **パラメータ**:
  - `minting_user`: 許可または禁止を切り替えるユーザーのアドレス。
