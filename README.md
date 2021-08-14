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


## Rinkeby

`npm run deploy:testnet`

<!-- TBD -->
