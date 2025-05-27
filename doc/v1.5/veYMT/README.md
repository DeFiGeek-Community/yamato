# veYMT Token

## Overview

The veYMT Token is an ERC-20 compatible token that is obtained by locking YMT tokens. However, this token does not have a `transfer()` function. It serves as a voting-escrow token, where locked tokens are assigned a weight based on the duration of the lock.

#### References

- [Curve DAO: Vote-Escrowed CRV](https://etherscan.io/address/0x5f3b5dfeb7b28cdbd7faba78963ee202a494e2a2#readContract)
- [Curve VotingEscrow Contract](https://curve.readthedocs.io/dao-vecrv.html)
- [The Curve DAO: Liquidity Gauges and Minting CRV](https://curve.readthedocs.io/dao-gauges.html)
- [LiquidityGaugeV6 Contract](https://github.com/curvefi/tricrypto-ng/blob/main/contracts/main/LiquidityGauge.vy)

---

## Events

### `Deposit`:

- **Description**: Occurs when a user deposits tokens.
- **Parameters**:
  - `provider`: Address of the user who made the deposit.
  - `value`: Amount of tokens deposited.
  - `locktime`: Duration of the lock.
  - `ts`: Timestamp.

### `Withdraw`:

- **Description**: Occurs when a user withdraws tokens.
- **Parameters**:
  - `provider`: Address of the user who made the withdrawal.
  - `value`: Amount of tokens withdrawn.
  - `ts`: Timestamp.

### `Supply`:

- **Description**: Triggered when the supply changes.
- **Parameters**:
  - `prevSupply`: Supply before the change.
  - `supply`: New supply.

---

## Variables

### `locked: public(mapping(address => LockedBalance))`

- **Description**: A mapping that holds the locked balance (LockedBalance struct) of each user. This includes the amount of tokens locked (`amount`) and the time when the lock ends (`end`).

### `epoch: public(uint256)`

- **Description**: Indicates the current epoch (period) number of the contract. An epoch is a unit of time used to track the state of the system, marking when certain events or changes are recorded.

### `token: public(address)`

- **Description**: Indicates the address of the YMT token that the veYMT token is based on. This is the address of the base currency used to lock YMT tokens in the veYMT token.

### `supply: public(uint256)`

- **Description**: Indicates the total supply of the contract. This value represents the total amount of tokens locked by all users and can be considered the total issuance of veYMT.

### `pointHistory: public(mapping(uint256 => Point))`

- **Description**: A mapping for tracking the state (Point struct) of the system at each epoch. The Point includes the bias (`bias`), slope (`slope`), timestamp (`ts`), and block number (`blk`).

### `userPointHistory: public(mapping(address => mapping(uint256 => Point)))`

- **Description**: A double mapping for tracking the state (Point struct) of each user at different epochs. This allows understanding what voting power the user had in the past.

### `userPointEpoch: public(mapping(address => uint256))`

- **Description**: A mapping holding the current epoch number for each user. This indicates the epoch in which the user's latest state was recorded.

### `slopeChanges: public(mapping(uint256 => int128))`

- **Description**: A mapping tracking the changes in slope (`slope`) planned for specific future times. This value is used to represent changes in voting power.

### `controller: public(address)`

- **Description**: Address of the controller (administrator) of the contract. The controller is responsible for managing certain functions of the contract.

### `transfersEnabled: public(bool)`

- **Description**: A boolean indicating whether token transfers are enabled. Included for compatibility with Aragon, but in practice, transfers are generally not performed with veYMT tokens.

### `name: public(string)`

- **Description**: Name of the token, which is "Voting-escrowed Yamato".

### `symbol: public(string)`

- **Description**: Symbol of the token, which is "veYMT".

### `decimals: public(uint8)`

- **Description**: Number of decimal places for the token, set based on the decimal places of the YMT token.

### `futureAdmin: public(address)`

- **Description**: Address of a future administrator. This is a temporary variable used during the transfer of ownership process. Once ownership is officially transferred, `controller` is updated.

---

## Functions

### `constructor(tokenAddr_: address)`

- **Description**: Constructor of the veYMT contract. Receives the address of the YMT token and performs initial setup of the contract.
- **Parameters**:
  - `tokenAddr_`: Address of the YMT token.

### `getLastUserSlope(addr_: address)`

- **Description**: Retrieves the most recent rate of decrease in voting power for a specified address.
- **Parameters**:
  - `addr_`: Wallet address of the user.

### `userPointHistoryTs(addr_: address, idx_: uint256)`

- **Description**: Retrieves the timestamp of a specific checkpoint for a user at a specified address.
- **Parameters**:
  - `addr_`: Wallet address of the user.
  - `idx_`: Epoch number of the user.

### `lockedEnd(addr_: address)`

- **Description**: Retrieves the timestamp when the lock ends for a specified address.
- **Parameters**:
  - `addr_`: Wallet address of the user.

### `checkpoint()`

- **Description**: Records global data as a checkpoint. This function is intended to be called externally.

### `depositFor(addr_: address, value_: uint256)`

- **Description**: Deposits and locks tokens on behalf of a specified address. This function is intended to be called externally.
- **Parameters**:
  - `addr_`: Address of the user for whom tokens are being deposited.
  - `value_`: Amount of tokens being deposited.

### `createLock(value_: uint256, unlockTime_: uint256)`

- **Description**: Creates a new lock and deposits tokens. The lock remains in place until the specified time.
- **Parameters**:
  - `value_`: Amount of tokens being deposited.
  - `unlockTime_`: Time when the tokens will be unlocked (in epoch seconds).

### `increaseAmount(value_: uint256)`

- **Description**: Adds tokens to an existing lock. The duration of the lock does not change.
- **Parameters**:
  - `value_`: Amount of tokens being added.

### `increaseUnlockTime(unlockTime_: uint256)`

- **Description**: Extends the unlock time for a lock. The amount of tokens does not change.
- **Parameters**:
  - `unlockTime_`: New unlock time (in epoch seconds).

### `withdraw()`

- **Description**: Withdraws tokens that have been unlocked. This function can only be called after the lock period has expired.

### `balanceOf(addr_: address, t_: uint256)`

- **Description**: Retrieves the current voting power of a specified address at a specified point in time.
- **Parameters**:
  - `addr_`: Wallet address of the user.
  - `t_`: Epoch time for obtaining the voting power.

### `balanceOf(addr_: address)`

- **Description**: Retrieves the current voting power of a specified address at the present time.
- **Parameters**:
  - `addr_`: Wallet address of the user.

### `balanceOfAt(addr_: address, block_: uint256)`

- **Description**: Measures the voting power of a specified address at a specific block height.
- **Parameters**:
  - `addr_`: Wallet address of the user.
  - `block_`: Block number for calculating the voting power.

### `totalSupply(t_: uint256)`

- **Description**: Calculates the total voting power at a specified point in time.
- **Parameters**:
  - `t_`: Epoch time for calculating the total voting power.

### `totalSupply()`

- **Description**: Calculates the total voting power at the current time.

### `totalSupplyAt(block_: uint256)`

- **Description**: Calculates the total voting power at a specific block in the past.
- **Parameters**:
  - `block_`: Block number for calculating the total voting power.

### `changeController(newController: address)`

- **Description**: Changes the controller. This function can only be called by the current controller.
- **Parameters**:
  - `newController`: Address of the new controller.

---

## Contract Details

### veYMT Contract:

- **Purpose**: The veYMT contract implements the functionality to lock YMT tokens and provide voting rights based on the lock duration. The locked tokens cannot be withdrawn until the specified period has elapsed.

### Lock Mechanism:

- **Mechanism of Lock**: Users deposit YMT tokens into the veYMT contract to gain voting rights based on the locked tokens. The lock duration is set by the user and can be for a maximum of 4 years.
  The change in voting rights in the veYMT token is calculated based on the amount of locked tokens and the lock duration. This calculation involves two concepts, "bias" and "slope".

### Bias and Slope

- **Bias (Bias)**: Indicates the amount of voting rights a user has at a certain point in time. This is proportional to the amount of tokens locked and the duration of the lock.
- **Slope (Slope)**: Indicates how the bias decreases over time. This depends on the amount of locked tokens and decreases as the lock period progresses.

## Calculation of Voting Rights

The calculation of voting rights uses the following formula:

$$ \text{Bias} = \text{Slope} \times (\text{Lock End Time} - \text{Current Time}) $$

Where,

- **Lock End Time**: The time when the user's token lock is scheduled to be released.
- **Current Time**: The current time.

### Example

For example, suppose a user locks 100 veYMT tokens for 4 years. In this case, the slope is the locked amount divided by the maximum lock period.

$$ \text{Slope} = \frac{100 \text{ veYMT}}{4 \times 365 \times 24 \times 3600 \text{ seconds}} $$

The bias at the time the lock starts is equal to the slope multiplied by the lock period. Therefore, the bias initially is 100 veYMT, but it gradually decreases over time.

### Effect of Lock Duration

- **Advantages of Long-Term Locks**: The longer the tokens are locked, the larger the initial bias and the greater the amount of voting rights.
- **Decrease Over Time**: However, as time passes, the slope causes the bias to decrease, and the voting rights gradually diminish.

In this way, veYMT tokens give more initial voting rights the longer the lock period, but these rights decrease over time. This mechanism allows users to gain greater voting rights through long-term commitments, but their influence decreases as the lock period expires.

### User Interaction:

- **Deposit**: Users can deposit a specific amount of YMT tokens and lock them for a specified period.
- **Increase Lock**: Users can add tokens to an existing lock or extend the lock period.
- **Withdrawal**: After the lock period has ended, users can withdraw the locked tokens.
