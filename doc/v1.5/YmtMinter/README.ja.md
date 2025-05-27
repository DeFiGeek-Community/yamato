# YMT Minter

## 概要

Token Minter は、特定のスコアレジストリからトークンを mint するためのコントラクトです。YMT トークンを mint する機能を提供します。また、ユーザーが他のユーザーに代わって mint する権限を与えることもできます。

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

### `toggle()`

- **説明**: コントラクトの状態を一時停止または再開します。この関数は、コントラクトの管理者（governance）のみが呼び出すことができます。コントラクトが一時停止中の場合、この関数はコントラクトを再開します。逆に、コントラクトがアクティブな状態の場合、一時停止します。一時停止中は、コントラクトの主要な機能が使用不可になります。
- **アクセス制限**: 管理者のみ。

### `YMT()`

- **説明**: YMT トークンのアドレスを返します。

### `scoreWeightController()`

- **説明**: ScoreWeightController コントラクトのアドレスを返します。
