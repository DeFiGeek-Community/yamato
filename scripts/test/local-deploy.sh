#!/bin/bash

if [ ! -f deployments/localhost/.chainId ]; then
    echo "Creating .chainId file..."
    mkdir -p deployments/localhost
    chmod -R 777 deployments/localhost
    echo "31337" > deployments/localhost/.chainId
else
    echo ".chainId file already exists. Skipping creation."
fi

# npx hardhat clean
# npx hardhat compile

echo "========================================"
echo "V1 deploy"
echo "========================================"

npx hardhat deploy --tags ChainLinkMockEthUsd,ChainLinkMockJpyUsd,TellorCallerMock,PriceFeed,CJPY,FeePool,CurrencyOS,Yamato,YamatoAction,Pool,PriorityRegistry,setDeps,addYamato,setCOSCJPY --network localhost

# 権限委譲
npx hardhat deploy --tags transferGovernance --network localhost
npx hardhat run upgrade/safeTxCreate/090_v1acceptGovernance.ts --network localhost

echo "========================================"
echo "V1.5 deploy"
echo "========================================"

npx hardhat deploy --tags YmtVesting,YMT,veYMT,ScoreWeightController,YmtMinter,ScoreRegistry,setYmtToken,setMinter,addScore --network localhost

npx hardhat run upgrade/batches/v1.5-update-deployImpl.ts --network localhost
npx hardhat run upgrade/batches/v1.5-update-safePropose.ts --network localhost

# 権限委譲
npx hardhat deploy --tags transferGovernanceV15 --network localhost
npx hardhat run upgrade/safeTxCreate/091_v15acceptGovernance.ts --network localhost

echo "========================================"
echo "V2 deploy"
echo "========================================"

sed -i '' 's/^CURRENCY=.*/CURRENCY=CUSD/' .env

npx hardhat deploy --tags YmtOS_V2,PriceFeed_USD_V2,CURRENCY_V2,CurrencyOS_V2,Yamato_V2,YamatoAction_V2,Pool_V2,PriorityRegistry_V2,setDeps_V2,addYamato_V2,setYmtOS_V2,setCurrencyOS_CURRRECY_V2,addCurrencyOS_YmtOS_V2,ScoreRegistry_V2,setScoreRegistry_V2 --network localhost
npx hardhat run upgrade/batches/v2-update-deployImpl.ts --network localhost

sed -i '' 's/^CURRENCY=.*/CURRENCY=CEUR/' .env
npx hardhat deploy --tags ChainLinkMockEurUsd,PriceFeed_EUR_V2,CURRENCY_V2,CurrencyOS_V2,Yamato_V2,YamatoAction_V2,Pool_V2,PriorityRegistry_V2,setDeps_V2,addYamato_V2,setYmtOS_V2,setCurrencyOS_CURRRECY_V2,addCurrencyOS_YmtOS_V2,ScoreRegistry_V2,setScoreRegistry_V2 --network localhost

sed -i '' 's/^CURRENCY=.*/CURRENCY=CUSD/' .env
npx hardhat run upgrade/batches/v2-update-safePropose.ts --network localhost

sed -i '' 's/^CURRENCY=.*/CURRENCY=CEUR/' .env
npx hardhat run upgrade/batches/v2-update-safeProposeSecond.ts --network localhost

# 権限委譲
sed -i '' 's/^CURRENCY=.*/CURRENCY=CUSD/' .env
npx hardhat deploy --tags transferGovernance_V2 --network localhost
npx hardhat run upgrade/batches/v2-update-governance.ts --network localhost

sed -i '' 's/^CURRENCY=.*/CURRENCY=CEUR/' .env
npx hardhat deploy --tags transferGovernance_V2 --network localhost
npx hardhat run upgrade/batches/v2-update-governanceSecond.ts --network localhost