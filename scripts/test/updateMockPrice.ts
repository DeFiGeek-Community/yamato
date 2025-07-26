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

    // await executeTransaction(contractAddress, contractABI, "setPriceToDefault");

    const adminPrivateKey = process.env.FOUNDATION_PRIVATE_KEY;
    if (!adminPrivateKey) {
      console.error("FOUNDATION_PRIVATE_KEY is not defined in .env file");
      return;
    }
    // JsonRpcProviderと秘密鍵からWalletを生成し、サイナーとして使用
    const provider = new ethers.providers.JsonRpcProvider(
      "http://127.0.0.1:8545/"
    );
    const signer = new ethers.Wallet(adminPrivateKey, provider);

    const contract = new ethers.Contract(contractAddress, contractABI, signer);

    const transactionResponse = await contract["setPriceToDefault"]();
    await transactionResponse.wait(); // トランザクションの確定を待つ

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

// npx hardhat run scripts/test/updateMockPrice.ts --network localhost
