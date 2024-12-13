import { ethers } from "ethers";
import { readDeploymentAddress } from "../../src/addressUtil";
import { setNetwork, setProvider, getFoundation } from "../../src/deployUtil";
import { genABI } from "../../src/genABI";

async function main() {
  setNetwork(process.env.NETWORK);
  await setProvider();

  const currency = process.env.CURRENCY;

  // CURRENCYが設定されていない場合は終了
  if (!currency) {
    console.error("CURRENCY environment variable is not set.");
    return;
  }

  // コントラクト名とガバナンス関連の関数名のマッピング
  const contracts = {
    YmtOS: {
      name: "YmtOS",
      governanceFunction: "governance",
      version: "",
      proxy: true,
    },
    PriceFeedSingle: {
      name: currency == "CUSD" ? "PriceFeedSingle" : "PriceFeed",
      governanceFunction: "governance",
      version: "",
      proxy: true,
    },
    currencyOS: {
      name: "CurrencyOS",
      governanceFunction: "governance",
      version: "V4",
      proxy: true,
    },
    Pool: {
      name: "Pool",
      governanceFunction: "governance",
      version: "V2",
      proxy: true,
    },
    PriorityRegistry: {
      name: "PriorityRegistry",
      governanceFunction: "governance",
      version: "V6",
      proxy: true,
    },
    yamato: {
      name: "Yamato",
      governanceFunction: "governance",
      version: "V4",
      proxy: true,
    },
    YamatoDepositor: {
      name: "YamatoDepositor",
      governanceFunction: "governance",
      version: "V3",
      proxy: true,
    },
    YamatoBorrower: {
      name: "YamatoBorrower",
      governanceFunction: "governance",
      version: "V2",
      proxy: true,
    },
    YamatoRepayer: {
      name: "YamatoRepayer",
      governanceFunction: "governance",
      version: "V3",
      proxy: true,
    },
    YamatoWithdrawer: {
      name: "YamatoWithdrawer",
      governanceFunction: "governance",
      version: "V3",
      proxy: true,
    },
    YamatoRedeemer: {
      name: "YamatoRedeemer",
      governanceFunction: "governance",
      version: "V5",
      proxy: true,
    },
    YamatoSweeper: {
      name: "YamatoSweeper",
      governanceFunction: "governance",
      version: "V3",
      proxy: true,
    },
    scoreRegistry: {
      name: "ScoreRegistry",
      governanceFunction: "governance",
      version: "",
      proxy: true,
    },
  };

  const multisigAddress = process.env.UUPS_PROXY_ADMIN_MULTISIG_ADDRESS;

  try {
    for (const [
      key,
      { name, governanceFunction, version, proxy },
    ] of Object.entries(contracts)) {
      const useCurrency = !["YmtOS"].includes(name); // currencyを追加しないコントラクトを指定
      const address = readDeploymentAddress(
        name,
        proxy ? "ERC1967Proxy" : "",
        useCurrency ? currency : undefined
      );
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
