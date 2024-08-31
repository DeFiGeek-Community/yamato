import { ethers } from "ethers";
import { readDeploymentAddress } from "../../src/addressUtil";
import { setNetwork, setProvider, getFoundation } from "../../src/deployUtil";
import { genABI } from "../../src/genABI";

async function main() {
  setNetwork(process.env.NETWORK);
  await setProvider();

  // コントラクト名とガバナンス関連の関数名のマッピング
  const contracts = {
    minter: {
      name: "YmtMinter",
      governanceFunction: "governance",
      version: "",
      proxy: true,
    },
    vesting: {
      name: "YmtVesting",
      governanceFunction: "contractAdmin",
      version: "",
      proxy: false,
    },
    ymt: {
      name: "YMT",
      governanceFunction: "admin",
      version: "",
      proxy: false,
    },
    yamato: {
      name: "Yamato",
      governanceFunction: "governance",
      version: "V4",
      proxy: true,
    },
    scoreRegistry: {
      name: "ScoreRegistry",
      governanceFunction: "governance",
      version: "",
      proxy: true,
    },
    scoreWeightController: {
      name: "ScoreWeightController",
      governanceFunction: "governance",
      version: "",
      proxy: true,
    },
    feePool: {
      name: "FeePool",
      governanceFunction: "governance",
      version: "V2",
      proxy: true,
    },
    currencyOS: {
      name: "CurrencyOS",
      governanceFunction: "governance",
      version: "V3",
      proxy: true,
    },
  };

  const multisigAddress = process.env.UUPS_PROXY_ADMIN_MULTISIG_ADDRESS;

  try {
    for (const [
      key,
      { name, governanceFunction, version, proxy },
    ] of Object.entries(contracts)) {
      const address = readDeploymentAddress(name, proxy ? "ERC1967Proxy" : "");
      const abi = genABI(`${name}${version ? version : ""}`);
      const instance = new ethers.Contract(address, abi, getFoundation());

      // ガバナンス関数が存在する場合のみ実行
      if (typeof instance[governanceFunction] === "function") {
        const governanceAddress = await instance[governanceFunction]();
        console.log(`Governance Address: ${governanceAddress}`);
        console.log(
          `${name} Governance Address Match:`,
          governanceAddress === multisigAddress
        );
      } else {
        console.log(`${name} does not have a ${governanceFunction} function.`);
      }
    }
  } catch (error) {
    console.error(`Error verifying governance addresses:`, error);
  }
}

export default main;
