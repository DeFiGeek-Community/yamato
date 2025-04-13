import { ethers } from "ethers";
import { readDeploymentAddress } from "../../src/addressUtil";
import { setNetwork, setProvider, getFoundation } from "../../src/deployUtil";
import { genABI } from "../../src/genABI";

async function main() {
  setNetwork(process.env.NETWORK);
  await setProvider();

  // コントラクトの情報を配列に格納
  const contracts = [
    "PriceFeed",
    "FeePool",
    "CurrencyOS",
    "Pool",
    "PriorityRegistry",
    "Yamato",
    "YamatoDepositor",
    "YamatoBorrower",
    "YamatoRepayer",
    "YamatoWithdrawer",
    "YamatoRedeemer",
    "YamatoSweeper",
  ].map((name) => ({
    name,
    address: readDeploymentAddress(name, "ERC1967Proxy"),
    abi: genABI(name),
  }));

  const multisigAddress = process.env.UUPS_PROXY_ADMIN_MULTISIG_ADDRESS;
  console.log(`期待されるガバナンスアドレス: ${multisigAddress}`);
  console.log("-------------------------------------------");

  try {
    for (const { name, address, abi } of contracts) {
      const instance = new ethers.Contract(address, abi, getFoundation());

      // ガバナンス関数が存在する場合のみ実行
      if (typeof instance.governance === "function") {
        const governanceAddress = await instance.governance();
        const pendingGovernanceAddress = await instance.pendingGovernance();
        
        console.log(`${name}:`);
        console.log(`  現在のガバナンスアドレス: ${governanceAddress}`);
        // console.log(`  保留中のガバナンスアドレス: ${pendingGovernanceAddress}`);
        console.log(`  マルチシグと一致: ${governanceAddress === multisigAddress}`);
        console.log("-------------------------------------------");
      } else {
        console.log(`${name} には governance 関数がありません。`);
        console.log("-------------------------------------------");
      }
    }
  } catch (error) {
    console.error(`ガバナンスアドレスの検証中にエラーが発生しました:`, error);
  }
}

export default main; 
main();

// npx hardhat run upgrade/mods/check_v1_governance.ts --network sepolia