# Fee Pool V2

## Overview

Fee Pool V2 is a contract for managing the fee pool and distributing fees. It distributes tokens within the pool to owners of veYMT (vote-escrowed YMT) tokens.

---

## Events

### `ToggleAllowCheckpointToken`:

- **Description**: Triggered when the permission to checkpoint tokens is toggled.
- **Parameters**:
  - `toggleFlag`: Toggle flag.

### `CheckpointToken`:

- **Description**: Triggered when the checkpoint of tokens is updated.
- **Parameters**:
  - `time`: Timestamp of the checkpoint.
  - `tokens`: Amount of tokens distributed.

### `Claimed`:

- **Description**: Triggered when fees are claimed.
- **Parameters**:
  - `recipient`: Address of the recipient.
  - `amount`: Amount of fees claimed.
  - `claimEpoch`: Epoch in which the claim was made.
  - `maxEpoch`: Maximum epoch.

### `Received`:

- **Description**: Triggered when tokens are sent to the contract.
- **Parameters**:
  - `sender`: Address of the sender.
  - `value`: Amount of tokens sent.

### `VeYMTSet`:

- **Description**: Triggered when the address of veYMT is set.
- **Parameters**:
  - `sender`: Address that performed the setting.
  - `veYMT`: Address of veYMT.

---

## Variables

### `startTime: public(uint256)`

- **Description**: Epoch time when fee distribution begins. Fee distribution starts from this time onwards.

### `timeCursorOf: mapping(address => uint256)`

- **Description**: A mapping recording each user's time cursor. It indicates the time when the user last claimed rewards.

### `userEpochOf: mapping(address => uint256)`

- **Description**: A mapping recording each user's current epoch. This provides necessary data for calculating token rewards when claimed by users.

### `timeCursor: public(uint256)`

- **Description**: The current time cursor. This is used to track the progression of time in fee calculations.

### `lastTokenTime: public(uint256)`

- **Description**: The last time tokens were processed. This time is used to efficiently manage the distribution of tokens.

### `tokensPerWeek: public(mapping(uint256 => uint256))`

- **Description**: A mapping recording the amount of tokens distributed each week. This is used to manage the weekly distribution amounts.

### `tokenLastBalance: public(uint256)`

- **Description**: The last recorded balance of tokens. This is used for distribution calculations when new tokens are added.

### `veSupply: public(mapping(uint256 => uint256))`

- **Description**: A mapping recording the total supply of veYMT each week. This is used to track the weekly supply of veYMT.

### `canCheckpointToken: public(bool)`

- **Description**: A boolean indicating whether any account can perform a token checkpoint. This is used to increase the flexibility of the contract.

### `isKilled: public(bool)`

- **Description**: A boolean indicating whether the contract has been stopped. If this value is `true`, the primary functions of the contract become unavailable.

---

## Functions

### `initialize(startTime_: uint256)`

- **Description**: Initializes the contract.
- **Parameters**:
  - `startTime_`: Start time for fee distribution.

### `checkpointToken()`

- **Description**: Updates the token checkpoint.

### `veForAt(user_: address, timestamp_: uint256)`

- **Description**: Retrieves the veYMT balance for a user at a specific timestamp.
- **Parameters**:
  - `user_`: Address of the user whose balance is being checked.
  - `timestamp_`: Timestamp at which the balance is being checked.

### `checkpointTotalSupply()`

- **Description**: Updates the checkpoint for the total supply of veYMT.

### `claim()`

- **Description**: Claims fees for `msg.sender`.

### `claim(addr_: address)`

- **Description**: Claims fees for a specified address.
- **Parameters**:
  - `addr_`: Address to claim fees for.

### `claimMany(receivers_: address[])`

- **Description**: Claims fees for multiple addresses in bulk.
- **Parameters**:
  - `receivers_`: Array of addresses to claim fees for.

### `toggleAllowCheckpointToken()`

- **Description**: Toggles the permission to checkpoint tokens.
- **Access Restriction**: Admin only.

### `killMe()`

- **Description**: Stops the contract and sends the balance to the governance address.
- **Access Restriction**: Admin only.

### `recoverBalance()`

- **Description**: Recovers native tokens from the contract.
- **Access Restriction**: Admin only.

### `setVeYMT(_veymt: address)`

- **Description**: Sets the address of veYMT.
- **Parameters**:
  - `_veymt`: Address of veYMT.
- **Access Restriction**: Admin only.
