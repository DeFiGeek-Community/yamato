import {
  setNetwork,
  getDeploymentAddressPathWithTag,
  getFoundation,
  setProvider,
} from "../../src/deployUtil";
import { genABI } from "../../src/genABI";
import { readFileSync } from "fs";
import * as ethers from "ethers";

(async () => {
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
    const proxyAddress = readFileSync(
      getDeploymentAddressPathWithTag(contractName, "ERC1967Proxy")
    ).toString();
    contractInstances[contractName] = new ethers.Contract(
      proxyAddress,
      genABI(contractName),
      getFoundation()
    );
  }

  async function checkImplementation(contractInstance, versionTag) {
    const currentImpl = await contractInstance.getImplementation();
    console.log(`${versionTag}Proxy`, contractInstance.address);
    console.log("governance", await contractInstance.governance());
    const expectedImpl = readFileSync(
      getDeploymentAddressPathWithTag(versionTag, "UUPSImpl")
    ).toString();
    console.log(`${versionTag}Impl`, currentImpl);
    console.log(`${versionTag}NewImpl`, expectedImpl);
    console.log(`${versionTag}Impl`, currentImpl.toString() === expectedImpl);
  }

  for (const [contractName, versionTag] of Object.entries(versions)) {
    await checkImplementation(
      contractInstances[contractName],
      `${contractName}${versionTag}`
    );
  }
})();
