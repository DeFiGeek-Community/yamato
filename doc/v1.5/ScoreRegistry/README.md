# Score Registry

## Overview

The `ScoreRegistry` contract is used within the Yamato Protocol to calculate users' working balances (score limits) and to facilitate appropriate distribution of YMT tokens based on users' collateral ratios and total debt amounts.

---

## Events

### `UpdateScoreLimit`:

- **Description**: Triggered when a user's score limit is updated.
- **Parameters**:
  - `user`: Address of the user.
  - `originalBalance`: Original balance.
  - `originalSupply`: Original supply.
  - `collateralRatio`: Collateral ratio.
  - `workingBalance`: Working balance.
  - `workingSupply`: Working supply.

---

## Variables

### `isKilled: public(bool)`

- **Description**: This flag indicates whether the contract is in a "killed" state. If `isKilled` is `true`, the main functionalities of the contract are disabled and cannot be used.

### `futureEpochTime: public(uint256)`

- **Description**: This is the timestamp indicating when the next epoch (period) of the contract starts.

### `inflationRate: public(uint256)`

- **Description**: Represents the inflation rate in the system.

### `workingBalances: public(mapping(address => uint256))`

- **Description**: A mapping that holds each user's "working balance".

### `workingSupply: public(uint256)`

- **Description**: Represents the total working supply of the system.

### `integrateInvSupplyOf: public(mapping(address => uint256))`

- **Description**: Holds the integrated value of the average inflation rate for each address from the last checkpoint to the present.

### `integrateCheckpointOf: public(mapping(address => uint256))`

- **Description**: Holds the timestamp of the last checkpoint for each address.

### `integrateFraction: public(mapping(address => uint256))`

- **Description**: A mapping holding the integrated value of the amount of rewards each user should receive over a specific period.

### `period: public(int128)`

- **Description**: A counter indicating the current period (epoch).

### `periodTimestamp: public(mapping(int128 => uint256))`

- **Description**: A mapping holding the start timestamp of each period (epoch).

### `integrateInvSupply: public(mapping(int128 => uint256))`

- **Description**: A mapping holding the integrated value of the inflation rate against the total supply for each period (epoch).

---

## Functions

### `initialize(ymtMinterAddr: address, yamatoAddr: address)`

- **Description**: Initializes the contract.
- **Parameters**:
  - `ymtMinterAddr`: Address of the YMT minter.
  - `yamatoAddr`: Address of the Yamato contract.

### `checkpoint(addr: address)`

- **Description**: Updates the checkpoint for the specified address.
- **Parameters**:
  - `addr`: Address to update.
- **Access Restriction**: Only related Yamato contracts.

### `updateScoreLimit(addr_: address, debt_: uint256, totalDebt_: uint256, collateralRatio_: uint256)`

- **Description**: Updates the user's score.
- **Parameters**:
  - `addr_`: User's address.
  - `debt_`: User's debt amount.
  - `totalDebt_`: Total debt amount of the system.
  - `collateralRatio_`: Collateral ratio.
- **Access Restriction**: Only related Yamato contracts.

### `userCheckpoint(addr_: address)`

- **Description**: Updates the user's checkpoint and score.
- **Parameters**:
  - `addr_`: User's address.
- **Access Restriction**: Only the user's own address or the YmtMinter contract.

### `kick(addr_: address)`

- **Description**: Kicks a user and resets their score limit.
- **Parameters**:
  - `addr_`: Address of the user to be kicked.

### `setKilled(isKilled_: bool)`

- **Description**: Sets the "killed" state of the contract. Executable by administrators only.
- **Parameters**:
  - `isKilled_`: Killed state.
- **Access Restriction**: Admin only.

### `integrateCheckpoint()`

- **Description**: Retrieves the timestamp of the last checkpoint.

### `YMT()`

- **Description**: Returns the address of the YMT token.

### `veYMT()`

- **Description**: Returns the address of the veYMT contract.

### `ymtMinter()`

- **Description**: Returns the address of the YmtMinter contract.

### `scoreWeightController()`

- **Description**: Returns the address of the ScoreWeightController contract.

---

## Contract Details

### Score Calculation Formula

The user's working balance is calculated using the following formula:

$$
\text{workingSupply} = \min\left( \text{ownDebt}, \left( \text{ownDebt} \times 0.4 \right) + \left( 0.6 \times \frac{\text{totalDebt} \times \text{ownVeYMT}}{\text{totalVeYMT}} \right) \right) * \text{collateralCoefficient}
$$

Where:

- **ownDebt**: User's CJPY borrowing amount.
- **totalDebt**: Total CJPY borrowing amount of the system.
- **ownVeYMT**: Balance of the user's veYMT tokens.
- **totalVeYMT**: Total supply of veYMT tokens.
- **collateralCoefficient**: A coefficient based on the user's collateral ratio. 2.5 for 250% or more, 2.0 for 200% or more, 1.5 for 150% or more, 1.0 for 130% or more, otherwise 0.

This calculation determines the `workingSupply` (working balance) which serves as the basis for receiving YMT token distribution for the user.

### Explanation of Integration Calculation

`integrateInvSupply` is an integrated value calculated over a specific period. It is represented by the following formula:

$$ \text{integrateInvSupply} = \int_{\text{start time}}^{\text{end time}} \frac{\text{rate}(t) \times \text{weight}(t)}{\text{workingSupply}(t)} \ dt $$

Where:

- t represents time.
- weight(t) is the relative weight of the ScoreRegistry at time t.
- rate(t) is the mining rate at time t.
- workingSupply(t) is the total working balance of the system at time t.

This integration is calculated over a specific period (usually weekly), and the new `integrateInvSupply` value reflects the average mining rate to working supply ratio over that period.
