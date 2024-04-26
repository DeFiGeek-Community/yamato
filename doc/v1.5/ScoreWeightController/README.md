# Score Weight Controller

## Overview

The Score Weight Controller is a contract that manages liquidity scores and controls the issuance of tokens through these scores.

---

## Events

### `NewScore`:

- **Description**: Triggered when a new score is added.
- **Parameters**:
  - `addr`: Address of the score.
  - `weight`: Weight of the score.

---

## Variables

### `nScores: public(int128)`

- **Description**: Total number of scores.

### `scores: public(mapping(address => int128))`

- **Description**: Mapping of scores associated with addresses.

---

## Functions

### `initialize(ymtAddr: address, veYmtAddr: address)`

- **Description**: Initializes the contract by setting the addresses for the YMT token and the veYMT contract.
- **Parameters**:
  - `ymtAddr`: Address of the YMT token.
  - `veYmtAddr`: Address of the veYMT contract.

### `addScore(addr_: address, weight_: uint256)`

- **Description**: Adds a score for the specified address and sets its weight.
- **Parameters**:
  - `addr_`: Address of the score.
  - `weight_`: Weight of the score.
- **Access Restriction**: Admin only.

### `checkpoint()`

- **Description**: A checkpoint function for recording common data across all scores. (Planned for implementation in V2.0)

### `checkpointScore(addr_: address)`

- **Description**: A checkpoint function for recording specific score and common data across all scores. (Planned for implementation in V2.0)
- **Parameters**:
  - `addr_`: Address of the score.

### `scoreRelativeWeight(addr_: address, time_: uint256)`

- **Description**: Retrieves the relative weight of the specified score. (Planned for implementation in V2.0. Returns a fixed value in V1.5.)
- **Parameters**:
  - `addr_`: Address of the score.
  - `time_`: Time for calculating the relative weight.

### `changeScoreWeight(addr_: address, weight_: uint256)`

- **Description**: Changes the weight of the specified score. (Planned for implementation in V2.0)
- **Parameters**:
  - `addr_`: Address of the score.
  - `weight_`: New weight of the score.
- **Access Restriction**: Admin only.

### `YMT()`

- **Description**: Returns the address of the YMT token.

### `veYMT()`

- **Description**: Returns the address of the veYMT contract.
