import { setNetwork, getFoundation, setProvider } from "../../src/deployUtil";
import { genABI } from "../../src/genABI";
import { readDeploymentAddress } from "../../src/addressUtil";
import * as ethers from "ethers";

async function main() {
  setNetwork(process.env.NETWORK);
  await setProvider();

  const currency = process.env.CURRENCY;

  // CURRENCYが設定されていない場合は終了
  if (!currency) {
    console.error("CURRENCY environment variable is not set.");
    return;
  }

  // currencyの値に応じてPriceFeedを選択
  const priceFeedContract = currency == "CUSD" ? "PriceFeedSingle" : "PriceFeed";

  const contracts = [
    priceFeedContract,
    "YamatoRepayer",
    "YamatoRedeemer",
    "YamatoWithdrawer",
    "YamatoSweeper",
    "YamatoDepositor",
    "YamatoBorrower",
    "Yamato",
    "Pool",
    "CurrencyOS",
    "ScoreRegistry",
  ];

  const contractInstances = {};

  for (const contractName of contracts) {
    const proxyAddress = readDeploymentAddress(
      contractName,
      "ERC1967Proxy",
      currency
    );
    contractInstances[contractName] = new ethers.Contract(
      proxyAddress,
      genABI(contractName),
      getFoundation()
    );
  }

  async function checkImplementation(contractInstance, contractName) {
    const currency = process.env.CURRENCY;
    const currentImpl = await contractInstance.getImplementation();
    console.log(`${contractName}Proxy`, contractInstance.address);
    const expectedImpl = readDeploymentAddress(
      contractName,
      "UUPSImpl",
      currency
    );
    console.log(`${contractName}Impl`, currentImpl);
    console.log(`${contractName}Impl`, currentImpl.toString() === expectedImpl);
  }

  for (const contractName of contracts) {
    await checkImplementation(
      contractInstances[contractName],
      `${contractName}`
    );
  }
}

export default main;