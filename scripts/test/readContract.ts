import { ethers } from "hardhat";
import { readDeploymentAddress } from "../../src/addressUtil";
import { genABI } from "../../src/genABI";

async function readContract(
  contractName: string,
  methodName: string,
  args: any[] = []
) {
  const currency = process.env.CURRENCY;
  const contractAddress = readDeploymentAddress(
    contractName,
    "ERC1967Proxy",
    currency
  );
  const contractABI = genABI(contractName + "V2");

  if (!contractAddress) {
    console.error(`${contractName} contract address not found.`);
    return;
  }

  try {
    // .envからLOCALHOST_ADMIN_PRIVATE_KEYを読み込む
    const adminPrivateKey = process.env.LOCALHOST_ADMIN_PRIVATE_KEY;
    if (!adminPrivateKey) {
      console.error("LOCALHOST_ADMIN_PRIVATE_KEY is not defined in .env file");
      return;
    }

    // JsonRpcProviderと秘密鍵からWalletを生成し、サイナーとして使用
    const provider = new ethers.providers.JsonRpcProvider(
      "http://localhost:8545"
    );
    const signer = new ethers.Wallet(adminPrivateKey, provider);

    const contract = new ethers.Contract(contractAddress, contractABI, signer);

    // 指定されたメソッドを呼び出し
    const result = await contract[methodName](...args);
    console.log(`Result from ${methodName}:`, result);
  } catch (error) {
    console.error(`Error reading from ${contractName}:`, error);
  }
}

async function main() {
  const contractName = "FeePool"; //readしたいコントラクト
  const methodName = "canCheckpointToken"; // readしたい関数名
  await readContract(contractName, methodName);
}

// スクリプトを実行
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
