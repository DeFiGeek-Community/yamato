# Yamato Protocol

## Overview
A stablecoin lending machine.
- 20% forefront fee and 110% minimal collateralization ratio (MCR).
- No penalty nor forcible liquidation on the individual collateralization ration (ICR) < MCR. You just have to sell the collateral at that price. In other words, in the worst case, you can be redeemed (= repay + withdraw) by others. But it's not a big deal, right?
- Any state transition could be back to the normal in the end.
- That's all, really.

![yamato (4)](https://user-images.githubusercontent.com/83639348/129440476-93175c19-bc92-4116-b851-98a9ec6a1eae.png)


## Spec
- See `./test/unit/index.test.ts`

## Dev first steps
1. Clone the latest code from yamato repos.
1. Initialize the local work space.
    1. $ cd yamato
    1. $ mkdir typechain
    1. $ npm i
1. Running the compile & test
    1. $ npx hardhat compile
    1. $ npx jest --projects unit.jest.config.ts

If it's working fine, you should see the tests run.
If not, please check that the npm dependencies are installed as expected. As of this writing, smock version is 1.1.5 and hardhat version is 2.2.1.

## Rinkeby
- Chainlink Mock (ETH/USD) 0x81CE5a8399e49dCF8a0ce2c0A0C7015bb1F042bC
- Chainlink Mock (JPY/USD) 0x6C4e3804ddFE3be631b6DdF232025AC760765279
- Tellor Mock (ETH/JPY) 0x5b46654612f6Ff6510147b00B96FeB8E4AA93FF6

`npm run deploy:testnet`

<!-- TBD -->
