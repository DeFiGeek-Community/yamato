# YMT Minter

## 概要

Token Minter は、特定のスコアレジストリからトークンを mint するためのコントラクトです。YMT トークンを mint する機能を提供します。また、ユーザーが他のユーザーに代わって mint する権限を与えることもできます。

---

## インターフェース

### `IScoreRegistry`:

- **説明**: スコアレジストリから情報を取得するためのインターフェース。
- **関数**:
  - `integrateFraction(addr: address) -> uint256`: 指定したアドレスの積分値を取得する。
  - `userCheckpoint(addr: address) -> bool`: ユーザーチェックポイントを更新する。

### `IYMT`:

- **説明**: トークンを mint するための ERC20 トークンインターフェース。
- **関数**:
  - `mint(_to: address, _amount: uint256) -> bool`: トークンを mint する。

---

## イベント

### `Minted`:

- **説明**: トークンが mint されたときにトリガーされるイベント。
- **パラメータ**:
  - `recipient`: 受取人のアドレス。
  - `score`: 使用されたスコアレジストリのアドレス。
  - `minted`: mint されたトークンの量。

---

## 変数

### `minted: public(mapping(address => mapping(address => uint256)))`

- **説明**: すでに mint されたトークンの量を追跡するためのマップ。

### `allowedToMintFor: public(mapping(address => mapping(address => bool)))`

- **説明**: あるユーザーが別のユーザーに代わってトークンを mint することを許可するためのマップ。

---

## 関数

### `initialize(_ymtAddr: address, _scoreWeightControllerAddr: address)`

- **説明**: コントラクトの初期化関数。YMT トークンとスコアウェイトコントローラーのアドレスを設定する。
- **パラメータ**:
  - `_ymtAddr`: YMT トークンのアドレス。
  - `_scoreWeightControllerAddr`: スコアウェイトコントローラーのアドレス。

### `_mintFor(scoreAddr: address, _for: address)`

- **説明**: 内部関数。指定したスコアレジストリからトークンを mint する。
- **パラメータ**:
  - `scoreAddr`: スコアレジストリのアドレス。
  - `_for`: トークンを受け取るアドレス。

### `mint(scoreAddr: address)`

- **説明**: `msg.sender`に属するすべてのトークンを mint して送信する。
- **パラメータ**:
  - `scoreAddr`: スコアレジストリのアドレス。

### `mintFor(scoreAddr: address, _for: address)`

- **説明**: `_for`のためのトークンを mint する。`msg.sender`が承認されている場合のみ可能。
- **パラメータ**:
  - `scoreAddr`: スコアレジストリのアドレス。
  - `_for`: トークンを受け取るアドレス。

### `toggleApproveMint(mintingUser: address)`

- **説明**: `mintingUser`が`msg.sender`の代わりにトークンを mint することを許可または禁止する。
- **パラメータ**:
  - `mintingUser`: 許可または禁止を切り替えるユーザーのアドレス。
