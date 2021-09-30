# Yamato Protocol

## Overview
A stablecoin lending machine.
- You can borrow CJPY with collateralising ETH.
- The CJPY token can be redeemed in ETH with 1 CJPY = 1 JPY rate (The ETH/JPY rate is calcurated by the ChainLink oracle. And the Tellor oracle is serving as a fail-safe oracle.)
- The total collateral ratio (TCR) won't be below 100% and so your CJPY always be kept safe.
- The reason why TCR is always above 100% is that the redemption criteria (= minimal collateral ratio / MCR) is 110% and so the protocol always has enough reserve.
- When a huge ETH price dump happens, the real value of the protocol reserve will be below 100%. And so we set a non-linear fee table to mitigate not to make the TCR near 110%. 
- We use YMT token (designate like the great CRV token) allocation to make TCR higher, and gradually it will be decreased because a real lending infrastructure ideally don't need it.
- Any state transition could be back to the normal in the end.
- That's all, really.
- We'll provide various rationale of why it'll work well. Stay tuned ;)

-![yamato](./yamato.png)

## Spec
- See `./test/unit`

## Configurations
As of this writing, the following library versions have been confirmed working fine.
- Node: 14.16.1
- npm: 6.14.12
- hardhat: 2.1.1
- smock: 1.1.5

Please note, using a different version might result in commands like "npm i" and test to fail.

## Dev first steps
1. Install node & npm.
1. Clone the latest code from yamato repos.
1. Initialize the local work space.
    1. $ cd yamato
    1. $ mkdir typechain
    1. $ npm i
1. Running the compile & test.
    1. $ npx hardhat compile
    1. $ npx jest --projects unit.jest.config.ts

If it's working fine, you should be able to install the dependencies & see the tests run.
If not, please check that the npm dependencies are installed as expected referring to the Configurations section.

## Rinkeby
### Running deployment
`npm run deploy:testnet`

### Mock contract addresses
- Chainlink Mock (ETH/USD) 0x81CE5a8399e49dCF8a0ce2c0A0C7015bb1F042bC
- Chainlink Mock (JPY/USD) 0x6C4e3804ddFE3be631b6DdF232025AC760765279
- Tellor Mock (ETH/JPY) 0x5b46654612f6Ff6510147b00B96FeB8E4AA93FF6

<!-- TBD -->
