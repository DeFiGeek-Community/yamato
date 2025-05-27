# Yamato Protocol Documentation v1.5

This document summarizes details about Yamato Protocol v1.5. \
Please refer to the corresponding links for details on each contract.

## List of Newly Added Contracts

- **[FeePoolV2](FeePoolV2/README.md)**  
  FeePoolV2 is a contract for managing the fee pool and distributing fees.

- **[ScoreRegistry](ScoreRegistry/README.md)**  
  ScoreRegistry is a contract that calculates user scores and stores appropriate distribution information for YMT tokens.

- **[ScoreWeightController](ScoreWeightController/README.md)**  
  ScoreWeightController is a contract that manages the voting weight (distribution rate) for each ScoreRegistry.

- **[veYMT](veYMT/README.md)**  
  veYMT is a contract that locks YMT tokens and provides voting rights according to the lock period.

- **[YMT](YMT/README.md)**  
  YMT is the utility token contract associated with Yamato Protocol.

- **[YmtMinter](YmtMinter/README.md)**  
  YmtMinter is a contract for minting YMT tokens.

## veYMT Use Case Diagram

The following diagram shows the use cases related to veYMT.

![veYMT Use Case Diagram](veYMT/usecase.png)

## FeePool Use Case Diagram

The following diagram shows the use cases related to fee distribution.

![FeePool Use Case Diagram](FeePoolV2/usecase.png)

# Yamato v1.5 Contracts

Below is a list of the latest version contracts used in v1.5.

## Deployed Contracts

- `CJPY.sol`
- `CurrencyOSV3.sol` - Latest version of CurrencyOS
- `FeePoolV2.sol` - Latest version of FeePool
- `PoolV2.sol` - Latest version of Pool
- `PriceFeedV3.sol` - Latest version of PriceFeed
- `PriorityRegistryV6.sol` - Latest version of PriorityRegistry
- `YamatoBorrowerV2.sol` - Latest version of YamatoBorrower
- `YamatoDepositorV3.sol` - Latest version of YamatoDepositor
- `YamatoRedeemerV5.sol` - Latest version of YamatoRedeemer
- `YamatoRepayerV3.sol` - Latest version of YamatoRepayer
- `YamatoSweeperV3.sol` - Latest version of YamatoSweeper
- `YamatoV4.sol` - Latest version of Yamato
- `YamatoWithdrawerV3.sol` - Latest version of YamatoWithdrawer
- `YmtMinter.sol` - Added in v1.5
- `ScoreRegistry.sol` - Added in v1.5
- `ScoreWeightController.sol` - Added in v1.5
- `YMT.sol` - Added in v1.5
- `YmtVesting.sol` - Added in v1.5
- `veYMT.sol` - Added in v1.5

## Unused or Test Contracts

- `Currency.sol` - Undeployed inherited contract
- `Vester.sol` - Undeployed
- `VesterFactory.sol` - Undeployed
- `YmtOS.sol` - Undeployed
- `Import.sol` - For upgradable proxy testing
- `ChainLinkMock.sol` - For testing
- `TellorCallerMock.sol` - For testing
