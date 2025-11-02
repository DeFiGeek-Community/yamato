# Yamato v1.0 デプロイ

## 基本デプロイ

npx hardhat deploy --tags ChainLinkMockEthUsd --network localhost
npx hardhat deploy --tags ChainLinkMockJpyUsd --network localhost
npx hardhat deploy --tags TellorCallerMock --network localhost
npx hardhat deploy --tags PriceFeed --network localhost
npx hardhat deploy --tags CJPY --network localhost
npx hardhat deploy --tags FeePool --network localhost
npx hardhat deploy --tags CurrencyOS --network localhost
npx hardhat deploy --tags Yamato --network localhost
npx hardhat deploy --tags YamatoAction --network localhost
npx hardhat deploy --tags Pool --network localhost
npx hardhat deploy --tags PriorityRegistry --network localhost
npx hardhat deploy --tags setDeps --network localhost
npx hardhat deploy --tags addYamato --network localhost
npx hardhat deploy --tags setCOSCJPY --network localhost
npx hardhat deploy --tags transferGovernance --network localhost

## Etherscan の Verify

- `npx hardhat deploy --tags Verify --network sepolia`

## ガバナンスをマルチシグへ移行

- `npx hardhat run upgrade/safeTxCreate/090_v1acceptGovernance.ts --network sepolia`

# Yamato v1.5 デプロイ

## YMT、ve 関連コントラクトのデプロイ

- `npx hardhat deploy --tags YmtVesting --network localhost`
- `npx hardhat deploy --tags YMT --network localhost`
- `npx hardhat deploy --tags veYMT --network localhost`
- `npx hardhat deploy --tags ScoreWeightController --network localhost`
- `npx hardhat deploy --tags YmtMinter --network localhost`
- `npx hardhat deploy --tags ScoreRegistry --network localhost`

## アップグレード

- `npx hardhat run upgrade/batches/v1.5-update-deployImpl.ts --network localhost`
- `npx hardhat deploy --tags Verify --network sepolia`

- `npx hardhat run upgrade/batches/v1.5-update-safePropose.ts  --network localhost`
- `npx hardhat run upgrade/batches/v1.5-update-safePropose2.ts  --network localhost`

## アドレス初期設定

- `npx hardhat deploy --tags setYmtToken --network localhost`
- `npx hardhat deploy --tags setMinter --network localhost`
- `npx hardhat deploy --tags addScore --network localhost`

## Etherscan の Verify

- `npx hardhat deploy --tags Verify --network sepolia`

## ガバナンスをマルチシグへ移行

- `npx hardhat deploy --tags transferGovernanceV15 --network sepolia`
- `npx hardhat run upgrade/safeTxCreate/091_v15acceptGovernance.ts  --network sepolia`

## アップグレードの確認

- `npx hardhat run upgrade/batches/v1.5-check-localTest.ts --network sepolia`

# Yamato v2 デプロイ

## CUSD デプロイ

sed -i '' 's/^CURRENCY=.*/CURRENCY=CUSD/' .env
npx hardhat deploy --tags YmtOS_V2 --network localhost
npx hardhat deploy --tags PriceFeed_USD_V2 --network localhost
npx hardhat deploy --tags CURRENCY_V2 --network localhost
npx hardhat deploy --tags CurrencyOS_V2 --network localhost
npx hardhat deploy --tags Yamato_V2 --network localhost
npx hardhat deploy --tags YamatoAction_V2 --network localhost
npx hardhat deploy --tags Pool_V2 --network localhost
npx hardhat deploy --tags PriorityRegistry_V2 --network localhost
npx hardhat deploy --tags setDeps_V2 --network localhost
npx hardhat deploy --tags addYamato_V2 --network localhost
npx hardhat deploy --tags setYmtOS_V2 --network localhost
npx hardhat deploy --tags setCurrencyOS_CURRRECY_V2 --network localhost
npx hardhat deploy --tags addCurrencyOS_YmtOS_V2 --network localhost
npx hardhat deploy --tags ScoreRegistry_V2 --network localhost
npx hardhat deploy --tags setScoreRegistry_V2 --network localhost
npx hardhat run upgrade/batches/v2-update-deployImpl.ts --network localhost
npx hardhat run upgrade/batches/v2-update-safePropose.ts --network localhost

## CEUR デプロイ

sed -i '' 's/^CURRENCY=.*/CURRENCY=CEUR/' .env
npx hardhat deploy --tags PriceFeed_EUR_V2 --network sepolia
npx hardhat deploy --tags CURRENCY_V2 --network sepolia
npx hardhat deploy --tags CurrencyOS_V2 --network sepolia
npx hardhat deploy --tags Yamato_V2 --network sepolia
npx hardhat deploy --tags YamatoAction_V2 --network sepolia
npx hardhat deploy --tags Pool_V2 --network sepolia
npx hardhat deploy --tags PriorityRegistry_V2 --network sepolia
npx hardhat deploy --tags setDeps_V2 --network sepolia
npx hardhat deploy --tags addYamato_V2 --network sepolia
npx hardhat deploy --tags setYmtOS_V2 --network sepolia
npx hardhat deploy --tags setCurrencyOS_CURRRECY_V2 --network sepolia
npx hardhat deploy --tags ScoreRegistry_V2 --network sepolia
npx hardhat deploy --tags setScoreRegistry_V2 --network sepolia
npx hardhat run upgrade/batches/v2-update-safeProposeSecond.ts --network sepolia

## 権限委譲

### CUSD

- `sed -i '' 's/^CURRENCY=.*/CURRENCY=CUSD/' .env`

- `npx hardhat deploy --tags transferGovernance_V2 --network sepolia`
- `npx hardhat run upgrade/batches/v2-update-governance.ts --network sepolia`

### CUSD 確認

- `npx hardhat run upgrade/batches/v2-update-check.ts --network sepolia`

### CEUR

- `sed -i '' 's/^CURRENCY=.*/CURRENCY=CEUR/' .env`

- `npx hardhat deploy --tags transferGovernance_V2 --network sepolia`
- `npx hardhat run upgrade/batches/v2-update-governanceSecond.ts --network sepolia`

### CEUR 確認

- `npx hardhat run upgrade/batches/v2-update-check.ts --network sepolia`

# Localhost のテスト用デプロイ

- `npx hardhat node --no-deploy`

## v1.0 デプロイ

- .env の PRIVATE_KEY を デプロイする秘密鍵に変更する
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

## v2 デプロイ

### CUSD

- .env を CURRENCY=CUSD に設定
- .env の PRIVATE_KEY を デプロイする秘密鍵に変更する
- `npx hardhat deploy --tags YmtOS_V2,PriceFeed_USD_V2,CURRENCY_V2,CurrencyOS_V2,Yamato_V2,YamatoAction_V2,Pool_V2,PriorityRegistry_V2,setDeps_V2,addYamato_V2,setYmtOS_V2,setCurrencyOS_CURRRECY_V2,addCurrencyOS_YmtOS_V2,ScoreRegistry_V2,setScoreRegistry_V2,transferGovernance_V2 --network localhost`
- `npx hardhat run upgrade/batches/v2-update-deployImpl.ts --network localhost`

### CUSD

- .env を CURRENCY=CEUR に設定
- `npx hardhat deploy --tags ChainLinkMockEurUsd,PriceFeed_EUR_V2,CURRENCY_V2,CurrencyOS_V2,Yamato_V2,YamatoAction_V2,Pool_V2,PriorityRegistry_V2,setDeps_V2,addYamato_V2,setYmtOS_V2,setCurrencyOS_CURRRECY_V2,addCurrencyOS_YmtOS_V2,ScoreRegistry_V2,setScoreRegistry_V2,transferGovernance_V2 --network localhost`

- .env を CURRENCY=CUSD に設定
- .env の PRIVATE_KEY を UUPS_PROXY_ADMIN_MULTISIG_ADDRESS の秘密鍵に変更する必要あり
- `npx hardhat run upgrade/batches/v2-update-safePropose.ts --network localhost`

- .env を CURRENCY=CEUR に設定
- `npx hardhat run upgrade/batches/v2-update-safeProposeSecond.ts --network localhost`
