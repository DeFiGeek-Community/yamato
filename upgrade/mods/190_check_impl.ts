import { setNetwork, getFoundation, setProvider } from "../../src/deployUtil";
import { genABI } from "../../src/genABI";
import { readDeploymentAddress } from "../../src/addressUtil";
import * as ethers from "ethers";

async function main() {
  setNetwork(process.env.NETWORK);
  await setProvider();

  const contracts = [
    "YamatoRepayer",
    "YamatoRedeemer",
    "YamatoWithdrawer",
    "YamatoSweeper",
    "YamatoDepositor",
    "YamatoBorrower",
    "Yamato",
    "CurrencyOS",
    "FeePool",
  ];

  const versions = {
    YamatoRepayer: "V3",
    YamatoRedeemer: "V5",
    YamatoWithdrawer: "V3",
    YamatoSweeper: "V3",
    YamatoDepositor: "V3",
    YamatoBorrower: "V2",
    Yamato: "V4",
    CurrencyOS: "V3",
    FeePool: "V2",
  };

  const contractInstances = {};

  for (const contractName of contracts) {
    const proxyAddress = readDeploymentAddress(contractName, "ERC1967Proxy");
    contractInstances[contractName] = new ethers.Contract(
      proxyAddress,
      genABI(contractName),
      getFoundation()
    );
  }

  async function checkImplementation(contractInstance, contractName) {
    const currentImpl = await contractInstance.getImplementation();
    console.log(`${contractName}Proxy`, contractInstance.address);
    console.log("governance", await contractInstance.governance());
    const expectedImpl = readDeploymentAddress(contractName, "UUPSImpl");
    console.log(`${contractName}Impl`, currentImpl);
    console.log(`${contractName}NewImpl`, expectedImpl);
    console.log(`${contractName}Impl`, currentImpl.toString() === expectedImpl);
  }

  for (const [contractName, versionTag] of Object.entries(versions)) {
    await checkImplementation(
      contractInstances[contractName],
      `${contractName}`
    );
  }
}

export default main;
