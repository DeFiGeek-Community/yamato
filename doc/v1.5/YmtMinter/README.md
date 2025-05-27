# YMT Minter

## Overview

Token Minter is a contract for minting tokens from a specific score registry. It provides the functionality to mint YMT tokens. It also allows users to grant others the authority to mint on their behalf.

---

## Events

### `Minted`:

- **Description**: Triggered when tokens are minted.
- **Parameters**:
  - `recipient`: Address of the recipient.
  - `score`: Address of the score registry used.
  - `minted`: Amount of tokens minted.

---

## Variables

### `minted: public(mapping(address => mapping(address => uint256)))`

- **Description**: A map for tracking the amount of tokens already minted.

### `allowedToMintFor: public(mapping(address => mapping(address => bool)))`

- **Description**: A map to allow one user to mint tokens on behalf of another user.

---

## Functions

### `initialize(_ymtAddr: address, _scoreWeightControllerAddr: address)`

- **Description**: Initialization function of the contract. Sets the addresses of the YMT token and the score weight controller.
- **Parameters**:
  - `_ymtAddr`: Address of the YMT token.
  - `_scoreWeightControllerAddr`: Address of the score weight controller.

### `mint(scoreAddr: address)`

- **Description**: Mints and sends all tokens belonging to `msg.sender`.
- **Parameters**:
  - `scoreAddr`: Address of the score registry.

### `mintFor(scoreAddr: address, _for: address)`

- **Description**: Mints tokens for `_for`. Can only be done if `msg.sender` is authorized.
- **Parameters**:
  - `scoreAddr`: Address of the score registry.
  - `_for`: Address to receive the tokens.

### `toggleApproveMint(mintingUser: address)`

- **Description**: Allows or forbids `mintingUser` from minting tokens on behalf of `msg.sender`.
- **Parameters**:
  - `mintingUser`: Address of the user whose permission is being toggled.

### `toggle()`

- **Description**: Pauses or resumes the contract's state. This function can only be called by the contract's administrator (governance). If the contract is paused, this function will resume it. Conversely, if the contract is active, it will be paused. During a pause, the main functionalities of the contract become unavailable.
- **Access Restriction**: Admin only.

### `YMT()`

- **Description**: Returns the address of the YMT token.

### `scoreWeightController()`

- **Description**: Returns the address of the ScoreWeightController contract.
