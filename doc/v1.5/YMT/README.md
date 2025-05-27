# YMT Token

## Overview

The YMT Token is a distributive token with inflation, characterized by a decreasing issuance rate over time. This token complies with the ERC20 standard and extends ERC20Permit.

---

## Events

### `UpdateMiningParameters`:

- **Description**: Triggered when mining parameters (time, rate, supply) are updated.
- **Parameters**:
  - `time`: The updated time.
  - `rate`: The new mining rate.
  - `supply`: The updated supply.

### `SetMinter`:

- **Description**: Occurs when the ymtMinter address is set.
- **Parameters**:
  - `ymtMinter`: The address of the ymtMinter.

### `SetAdmin`:

- **Description**: Occurs when the admin address is set or updated.
- **Parameters**:
  - `admin`: The address of the new admin.

---

## Variables

### `ymtMinter: public(address)`

- **Description**: Address for minting (creating) tokens.

### `admin: public(address)`

- **Description**: Address of the admin.

### `miningEpoch: public(int128)`

- **Description**: Current mining epoch.

### `startEpochTime: public(uint256)`

- **Description**: Start time of the current epoch.

### `rate: public(uint256)`

- **Description**: Current mining rate.

### `startEpochSupply: public(uint256)`

- **Description**: Supply at the start of the current epoch.

### `startTime: public(uint256)`

- **Description**: Time when deployed.

---

## Functions

### `constructor(ymtVestingAddr: address)`

- **Description**: Constructor of the contract. Sets up initial supply and vesting supply.
- **Parameters**:
  - `ymtVestingAddr`: Address for receiving the vesting supply.

### `updateMiningParameters()`

- **Description**: Updates the mining parameters.

### `startEpochTimeWrite()`

- **Description**: Retrieves and updates the start time of the current mining epoch if necessary.

### `futureEpochTimeWrite()`

- **Description**: Retrieves and updates the start time of the next mining epoch if necessary.

### `availableSupply()`

- **Description**: Returns the total number of tokens currently in existence.

### `mintableInTimeframe(start: uint256, end: uint256)`

- **Description**: Calculates the amount of tokens that can be minted within a specified timeframe.
- **Parameters**:
  - `start`: Start time of the timeframe.
  - `end`: End time of the timeframe.

### `setMinter(_ymtMinter: address)`

- **Description**: Sets the ymtMinter address.
- **Parameters**:
  - `_ymtMinter`: New address of the ymtMinter.
- **Access Restriction**: Admin only.

### `setAdmin(_admin: address)`

- **Description**: Sets a new admin.
- **Parameters**:
  - `_admin`: Address of the new admin.
- **Access Restriction**: Admin only.

### `mint(_to: address, _value: uint256)`

- **Description**: Mints (creates) tokens to a specified address.
- **Parameters**:
  - `_to`: Recipient's address.
  - `_value`: Amount of tokens to mint.
- **Access Restriction**: Only the ymtMinter contract.

### `burn(_value: uint256)`

- **Description**: Burns (destroys) tokens owned by `msg.sender`.
- **Parameters**:
  - `_value`: Amount of tokens to burn.

---

## Contract Details

### Token Inflation and Mining

The mining rate of YMT tokens decreases annually by 10%. This decrease is determined by a rate reduction factor. To calculate the specific reduction percentage, the initial rate, rate reduction factor, and rate denominator are used to compute the new rate each year.

#### Calculation of Mining Rate Reduction

- **Initial Rate**: Annual `55,000,000` YMT.
- **Rate Reduction Factor**: `1_111_111_111_111_111_111`.
- **Rate Denominator**: `10^18`.

#### Calculation of Mining Rate Reduction

The formula for calculating the new mining rate is as follows:

$$
\text{New Rate} = \frac{\text{Current Rate} \times \text{Rate Reduction Factor}}{\text{Rate Denominator}}
$$

Using this formula, the new mining rate for each epoch can be calculated.

#### Calculation of Specific Reduction Percentage

For example, the calculation of the rate reduction for the first few years is as follows:

1. **Year 1**: Initial rate is `55,000,000` YMT/year.
2. **Year 2**: New rate is `55,000,000 * 1_111_111_111_111_111_111 / 10^18 = 49,166,666.667` YMT/year.
3. **Year 3**: New rate is `49,166,666.667 * 1_111_111_111_111_111_111 / 10^18 = 43,703,703.704` YMT/year.
4. **Year 4**: New rate is `43,703,703.704 * 1_111_111_111_111_111_111 / 10^18 = 39,259,259.259` YMT/year.

This calculation shows that the rate decreases by approximately 10% each year. This decrease is designed to reduce the mining rate annually and control the inflation of the token over time.
