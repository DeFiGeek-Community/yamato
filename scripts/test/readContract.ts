import { ethers } from "hardhat";
import { readDeploymentAddress } from "../../src/addressUtil";
import { genABI } from "../../src/genABI";

async function readContract(contractName: string, methodName: string, args: any[] = []) {
  const currency = process.env.CURRENCY;
  const contractAddress = readDeploymentAddress(contractName, "ERC1967Proxy", currency);
  const contractABI = genABI(contractName);

  if (!contractAddress) {
    console.error(`${contractName} contract address not found.`);
    return;
  }

  try {
    // .envからDEPLOYER_PRIVATE_KEYを読み込む
    const deployerPrivateKey = process.env.DEPLOYER_PRIVATE_KEY;
    if (!deployerPrivateKey) {
      console.error("DEPLOYER_PRIVATE_KEY is not defined in .env file");
      return;
    }

    // JsonRpcProviderと秘密鍵からWalletを生成し、サイナーとして使用
    const provider = new ethers.providers.JsonRpcProvider("http://localhost:8545");
    const signer = new ethers.Wallet(deployerPrivateKey, provider);

    const contract = new ethers.Contract(contractAddress, contractABI, signer);

    // 指定されたメソッドを呼び出し
    const result = await contract[methodName](...args);
    console.log(`Result from ${methodName}:`, result);
  } catch (error) {
    console.error(`Error reading from ${contractName}:`, error);
  }
}

async function main() {
  const contractName = "Yamato"; //readしたいコントラクト
  const methodName = "currencyOS"; // readしたい関数名
  await readContract(contractName, methodName);
}

// スクリプトを実行
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });