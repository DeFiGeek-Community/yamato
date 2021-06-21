# Yamato Protocol

## Overview (Use case diagram + Class diagram)
A stablecoin lending machine.
- 20% forefront fee and 110% minimal collateralization ratio (MCR).
- No penalty nor forcible liquidation on the individual collateralization ration (ICR) < MCR. You just have to sell the collateral at that price. In other words, in the worst case, you can be redeemed (= repay + withdraw) by others. But it's not a big deal, right?
- Any state transition could be back to the normal in the end.
- That's all, really.

<!-- TBD -->
<!-- ![Overview (Use case diagram + Class diagram)](./yamato.png) -->


## Spec
- See `./test/unit/index.test.ts`


## Rinkeby

`npm run deploy:testnet`

<!-- TBD -->