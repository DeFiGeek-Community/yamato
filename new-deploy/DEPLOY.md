# Yamato v1.0 デプロイ

## 基本デプロイ

- `npx hardhat run scripts/deploy/v1/deploy-all.ts --network sepolia`
- `npx hardhat run scripts/setup/v1/setup-all.ts --network sepolia`

## Etherscan の Verify

- `npx hardhat run scripts/verify/verify-with-etherscan.ts --network sepolia`

## ガバナンスをマルチシグへ移行

- `npx hardhat run scripts/governance/v1-transfer-governance.ts --network sepolia`
- `.env`の`PRIVATE_KEY`をマルチシグ署名者の秘密鍵に変更
- `npx hardhat run scripts/governance/v1-accept-governance.ts --network sepolia`

# Yamato v1.5 デプロイ

## YMT、ve 関連コントラクトのデプロイ

- `npx hardhat run scripts/deploy/v1.5/deploy-all.ts --network sepolia`
- `npx hardhat run scripts/setup/v1.5/setup-all.ts --network sepolia`

## アップグレード

- `npx hardhat run scripts/upgrade/v1.5/upgrade-all.ts --network sepolia`

## Etherscan の Verify

- `npx hardhat run scripts/verify/verify-with-etherscan.ts --network sepolia`

## ガバナンスをマルチシグへ移行

- `npx hardhat run scripts/governance/v1.5-transfer-governance.ts --network sepolia`
- `.env`の`PRIVATE_KEY`をマルチシグ署名者の秘密鍵に変更
- `npx hardhat run scripts/governance/v1.5-accept-governance.ts --network sepolia`

# Yamato v2 デプロイ

## 前提条件

- `npx hardhat run scripts/deploy/v2/deploy-ymtos.ts --network sepolia`
- `npx hardhat run scripts/upgrade/v2/upgrade-cjpy-currencyos.ts --network sepolia`
- `npx hardhat run scripts/upgrade/v2/upgrade-score-weight-controller.ts --network sepolia`

## CUSD デプロイ

- `CURRENCY=CUSD npx hardhat run scripts/deploy/v2/deploy-all-cusd.ts --network sepolia`
- `CURRENCY=CUSD npx hardhat run scripts/setup/v2/setup-all-cusd.ts --network sepolia`

## CEUR デプロイ

- `CURRENCY=CEUR npx hardhat run scripts/deploy/v2/deploy-all-ceur.ts --network sepolia`
- `CURRENCY=CEUR npx hardhat run scripts/setup/v2/setup-all-ceur.ts --network sepolia`

## Etherscan の Verify

- `npx hardhat run scripts/verify/verify-with-etherscan.ts --network sepolia`
- `CURRENCY=CUSD npx hardhat run scripts/verify/verify-with-etherscan.ts --network sepolia`
- `CURRENCY=CEUR npx hardhat run scripts/verify/verify-with-etherscan.ts --network sepolia`

## 権限委譲

### CUSD

- `CURRENCY=CUSD npx hardhat run scripts/governance/v2-transfer-governance.ts --network sepolia`
- `.env`の`PRIVATE_KEY`をマルチシグ署名者の秘密鍵に変更
- `CURRENCY=CUSD npx hardhat run scripts/governance/v2-accept-governance.ts --network sepolia`

### CEUR

- `CURRENCY=CEUR npx hardhat run scripts/governance/v2-transfer-governance.ts --network sepolia`
- `.env`の`PRIVATE_KEY`をマルチシグ署名者の秘密鍵に変更
- `CURRENCY=CEUR npx hardhat run scripts/governance/v2-accept-governance.ts --network sepolia`
