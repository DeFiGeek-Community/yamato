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
      isCommunityAddress: false,
    },
    vesting: {
      name: "YmtVesting",
      governanceFunction: "contractAdmin",
      version: "",
      proxy: false,
      isCommunityAddress: true,
    },
    ymt: {
      name: "YMT",
      governanceFunction: "admin",
      version: "",
      proxy: false,
      isCommunityAddress: false,
    },
    yamato: {
      name: "Yamato",
      governanceFunction: "governance",
      version: "V4",
      proxy: true,
      isCommunityAddress: false,
    },
    scoreRegistry: {
      name: "ScoreRegistry",
      governanceFunction: "governance",
      version: "",
      proxy: true,
      isCommunityAddress: false,
    },
    scoreWeightController: {
      name: "ScoreWeightController",
      governanceFunction: "governance",
      version: "",
      proxy: true,
      isCommunityAddress: false,
    },
    feePool: {
      name: "FeePool",
      governanceFunction: "governance",
      version: "V2",
      proxy: true,
      isCommunityAddress: false,
    },
    currencyOS: {
      name: "CurrencyOS",
      governanceFunction: "governance",
      version: "V3",
      proxy: true,
      isCommunityAddress: false,
    },
  };

  const multisigAddress = process.env.UUPS_PROXY_ADMIN_MULTISIG_ADDRESS;
  const communityMultisigAddress = process.env.COMMUNITY_MULTISIG_ADDRESS;

  try {
    for (const [
      key,
      { name, governanceFunction, version, proxy, isCommunityAddress },
    ] of Object.entries(contracts)) {
      const address = readDeploymentAddress(name, proxy ? "ERC1967Proxy" : "");
      const abi = genABI(`${name}${version ? version : ""}`);
      const instance = new ethers.Contract(address, abi, getFoundation());

      // ガバナンス関数が存在する場合のみ実行
      if (typeof instance[governanceFunction] === "function") {
        const governanceAddress = await instance[governanceFunction]();
        console.log(`Governance Address: ${governanceAddress}`);
        if (isCommunityAddress) {
          console.log(
            `${name} Governance Address Match:`,
            governanceAddress === communityMultisigAddress
          );
        } else {
          console.log(
            `${name} Governance Address Match:`,
            governanceAddress === multisigAddress
          );
        }
      } else {
        console.log(`${name} does not have a ${governanceFunction} function.`);
      }
    }
  } catch (error) {
    console.error(`Error verifying governance addresses:`, error);
  }
}

export default main;
