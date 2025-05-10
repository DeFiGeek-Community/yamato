#!/bin/bash

# if [ ! -f deployments/localhost/.chainId ]; then
#     echo "Creating .chainId file..."
#     mkdir -p deployments/localhost
#     chmod -R 777 deployments/localhost
#     echo "31337" > deployments/localhost/.chainId
# else
#     echo ".chainId file already exists. Skipping creation."
# fi

# npx hardhat clean
# npx hardhat compile
sed -i '' 's/^FOUNDATION_PRIVATE_KEY=.*/FOUNDATION_PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80/' .env
sed -i '' 's/^LOCALHOST_ADMIN_PRIVATE_KEY=.*/LOCALHOST_ADMIN_PRIVATE_KEY=0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d/' .env
sed -i '' 's/^UUPS_PROXY_ADMIN_MULTISIG_ADDRESS=.*/UUPS_PROXY_ADMIN_MULTISIG_ADDRESS=0x70997970C51812dc3A010C7d01b50e0d17dc79C8/' .env
sed -i '' 's/^NETWORK=.*/NETWORK=localhost/' .env
sed -i '' 's/^YMT_CLI_MODE=.*/YMT_CLI_MODE=upgrade/' .env


# echo "========================================"
# echo "V1 deploy"
# echo "========================================"

# npx hardhat deploy --tags ChainLinkMockEthUsd,ChainLinkMockJpyUsd,TellorCallerMock,PriceFeed,CJPY,FeePool,CurrencyOS,Yamato,YamatoAction,Pool,PriorityRegistry,setDeps,addYamato,setCOSCJPY --network localhost

# # 権限委譲
# npx hardhat deploy --tags transferGovernance --network localhost
# npx hardhat run upgrade/safeTxCreate/090_v1acceptGovernance.ts --network localhost

echo "========================================"
echo "V1.5 deploy"
echo "========================================"

npx hardhat deploy --tags YmtVesting,YMT,veYMT,ScoreWeightController,YmtMinter,ScoreRegistry --network localhost

npx hardhat deploy --tags setYmtToken,setMinter,addScore --network localhost

npx hardhat run upgrade/batches/v1.5-update-deployImpl.ts --network localhost
npx hardhat run upgrade/batches/v1.5-update-safePropose.ts --network localhost
npx hardhat run upgrade/batches/v1.5-update-safePropose2.ts --network localhost



# 権限委譲
npx hardhat deploy --tags transferGovernanceV15 --network localhost
npx hardhat run upgrade/safeTxCreate/091_v15acceptGovernance.ts --network localhost
