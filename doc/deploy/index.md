# Yamato v1.0 デプロイ

npx hardhat deploy --tags PriceFeed --network sepolia
npx hardhat deploy --tags CJPY --network sepolia
npx hardhat deploy --tags CurrencyOS --network sepolia
npx hardhat deploy --tags Yamato --network sepolia
npx hardhat deploy --tags YamatoAction --network sepolia
npx hardhat deploy --tags Pool --network sepolia
npx hardhat deploy --tags PriorityRegistry --network sepolia
npx hardhat deploy --tags setDeps --network sepolia
npx hardhat deploy --tags addYamato --network sepolia
npx hardhat deploy --tags setCOSCJPY --network sepolia
npx hardhat deploy --tags transferGovernance --network sepolia
npx hardhat deploy --tags PriceFeed --network sepolia
npx hardhat deploy --tags PriceFeed --network sepolia
npx hardhat run upgrade/safe/290_v1acceptGovernance --network sepolia

# Yamato v1.0 デプロイ

npx hardhat deploy --tags YmtVesting --network sepolia
npx hardhat deploy --tags YMT --network sepolia
npx hardhat deploy --tags veYMT --network sepolia
npx hardhat deploy --tags ScoreWeightController --network sepolia
npx hardhat deploy --tags YmtMinter --network sepolia
npx hardhat deploy --tags ScoreRegistry --network sepolia
npx hardhat deploy --tags setYmtToken --network sepolia
npx hardhat deploy --tags setMinter --network sepolia
npx hardhat deploy --tags addScore --network sepolia

npx hardhat run upgrade/batches/v1.5-update.ts --network sepolia
npx hardhat run upgrade/batches/v1.5-update-safePropose.ts

npx hardhat run upgrade/deployImpl/013_check_impl.ts --network sepolia

npx hardhat run upgrade/mods/291_v15acceptGovernance.ts