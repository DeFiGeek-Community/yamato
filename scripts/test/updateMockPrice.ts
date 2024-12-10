import { ethers } from "hardhat";
import { readDeploymentAddress } from "../../src/addressUtil";
import { genABI } from "../../src/genABI";
import { executeTransaction } from "../../src/upgradeUtil";

const baseContractName = "ChainLinkMock";
const mockContracts = ["EthUsd", "EurUsd", "JpyUsd"].map(
  (suffix) => `${baseContractName}${suffix}`
);

async function updateMockPrice(contractName: string) {
  const contractAddress = readDeploymentAddress(contractName);
  const contractABI = genABI(baseContractName);

  if (!contractAddress) {
    console.error(`${contractName} contract address not found.`);
    return;
  }

  try {
    const deviation = 0; // 価格の変動率（例: 5%）
    const sign = true; // 価格を上昇させる場合はtrue、下降させる場合はfalse

    await executeTransaction(contractAddress, contractABI, "setPriceToDefault");

    console.log(`Price updated successfully for ${contractName}`);
  } catch (error) {
    console.error(`Error updating price for ${contractName}:`, error);
  }
}

async function main() {
  for (const contractName of mockContracts) {
    await updateMockPrice(contractName);
  }
}

// スクリプトを実行
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });