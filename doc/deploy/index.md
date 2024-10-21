# Yamato v1.0 デプロイ

## 基本デプロイ

- `npx hardhat deploy --tags PriceFeed --network sepolia`
- `npx hardhat deploy --tags CJPY --network sepolia`
- `npx hardhat deploy --tags CurrencyOS --network sepolia`
- `npx hardhat deploy --tags Yamato --network sepolia`
- `npx hardhat deploy --tags YamatoAction --network sepolia`
- `npx hardhat deploy --tags Pool --network sepolia`
- `npx hardhat deploy --tags PriorityRegistry --network sepolia`
- `npx hardhat deploy --tags setDeps --network sepolia`
- `npx hardhat deploy --tags addYamato --network sepolia`
- `npx hardhat deploy --tags setCOSCJPY --network sepolia`
- `npx hardhat deploy --tags transferGovernance --network sepolia`

## Etherscan の Verify

- `npx hardhat deploy --tags Verify --network sepolia`

## ガバナンスをマルチシグへ移行

- `npx hardhat run upgrade/safeTxCreate/290_v1acceptGovernance --network sepolia`

# Yamato v1.5 デプロイ

## YMT、ve 関連コントラクトのデプロイ

- `npx hardhat deploy --tags YmtVesting --network sepolia`
- `npx hardhat deploy --tags YMT --network sepolia`
- `npx hardhat deploy --tags veYMT --network sepolia`
- `npx hardhat deploy --tags ScoreWeightController --network sepolia`
- `npx hardhat deploy --tags YmtMinter --network sepolia`
- `npx hardhat deploy --tags ScoreRegistry --network sepolia`

## アップグレード

- `npx hardhat run upgrade/batches/v1.5-update.ts --network sepolia`
- `npx hardhat run upgrade/batches/v1.5-update-safePropose.ts`

## アドレス初期設定

- `npx hardhat deploy --tags setYmtToken --network sepolia`
- `npx hardhat deploy --tags setMinter --network sepolia`
- `npx hardhat deploy --tags setAddress --network sepolia`
- `npx hardhat deploy --tags setScoreRegistry --network sepolia`
- `npx hardhat deploy --tags setVeYMT --network sepolia`
- `npx hardhat deploy --tags addScore --network sepolia`

## Etherscan の Verify

- `npx hardhat deploy --tags Verify --network sepolia`

## アップグレードの確認

- `npx hardhat run upgrade/deployImpl/090_check_impl.ts --network sepolia`
- `npx hardhat run upgrade/deployImpl/091_check_setAddress.ts --network sepolia`

## ガバナンスをマルチシグへ移行

- `npx hardhat deploy --tags transferGovernanceV15 --network localhost`
- `npx hardhat run upgrade/safeTxCreate/091_v15acceptGovernance.ts  --network sepolia`
- `npx hardhat run upgrade/deployImpl/092_check_governance.ts --network sepolia`

# Localhost のテスト用デプロイ

- `npx hardhat node --no-deploy`

## v1.0 デプロイ

- `npx hardhat deploy --tags ChainLinkMockEthUsd,ChainLinkMockJpyUsd,TellorCallerMock,PriceFeed,CJPY,FeePool,CurrencyOS,Yamato,YamatoAction,Pool,PriorityRegistry,setDeps,addYamato,setCOSCJPY --network localhost`

## v1.5 デプロイ

- `npx hardhat run upgrade/batches/v1.5-update-deployImpl.ts --network localhost`
- `npx hardhat run upgrade/batches/v1.5-update-localTest.ts --network localhost`

- `npx hardhat deploy --tags YmtVesting,YMT,veYMT,ScoreWeightController,YmtMinter,ScoreRegistry,setYmtToken,setMinter,setAddress,setScoreRegistry,setVeYMT,addScore --network localhost`

## 権限委譲

- `npx hardhat deploy --tags transferGovernance,transferGovernanceV15 --network localhost`
- .env の PRIVATE_KEY を UUPS_PROXY_ADMIN_MULTISIG_ADDRESS の秘密鍵に変更する必要あり
- `npx hardhat run upgrade/safeTxCreate/090_v1acceptGovernance.ts --network localhost`
- `npx hardhat run upgrade/safeTxCreate/091_v15acceptGovernance.ts --network localhost`

## チェック

- `npx hardhat run upgrade/batches/v1.5-check-localTest.ts --network localhost`
