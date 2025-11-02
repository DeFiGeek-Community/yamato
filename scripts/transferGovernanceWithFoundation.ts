import { executeTransactionWithFoundation } from "../src/upgradeUtil";
import { readDeploymentAddress } from "../src/addressUtil";
import { readArtifact } from "../src/viemUtil";
import { setNetwork } from "../src/deployUtil";

async function transferGovernanceWithFoundation() {
  const multisigAddr = process.env.UUPS_PROXY_ADMIN_MULTISIG_ADDRESS;
  if (!multisigAddr) {
    throw new Error("UUPS_PROXY_ADMIN_MULTISIG_ADDRESS is not defined in .env");
  }

  setNetwork(process.env.NETWORK);

  // 各コントラクトの情報を取得
  const contracts = [
    { name: "PriceFeed", version: "" },
    { name: "FeePool", version: "" },
    { name: "CurrencyOS", version: "" },
    { name: "Pool", version: "" },
    { name: "PriorityRegistry", version: "" },
    { name: "Yamato", version: "" },
    { name: "YamatoDepositor", version: "" },
    { name: "YamatoBorrower", version: "" },
    { name: "YamatoRepayer", version: "" },
    { name: "YamatoWithdrawer", version: "" },
    { name: "YamatoRedeemer", version: "" },
    { name: "YamatoSweeper", version: "" }
  ];

  console.log(`Transferring governance to multisig address: ${multisigAddr}`);

  for (const contract of contracts) {
    try {
      console.log(`\nProcessing ${contract.name}...`);
      
      // コントラクトアドレスを取得
      const contractAddress = readDeploymentAddress(contract.name, "ERC1967Proxy");
      
      // アーティファクトからABIを取得
      const implNameBase = `${contract.name}${contract.version}`;
      const artifactPath = `./artifacts/contracts/${implNameBase}.sol/${implNameBase}.json`;
      const artifact = readArtifact(artifactPath);
      
      const result = await executeTransactionWithFoundation(
        contractAddress,
        artifact.abi,
        "setGovernance",
        [multisigAddr]
      );
      
      console.log(`✅ ${contract.name}.setGovernance(${multisigAddr}) executed successfully`);
      console.log(`   Transaction hash: ${result.hash}`);
      console.log(`   Status: ${result.receipt.status}`);
    } catch (error) {
      console.error(`❌ Failed to execute setGovernance for ${contract.name}:`, error.message);
    }
  }

  console.log("\n🎉 Governance transfer completed!");
}

// スクリプトが直接実行された場合のみ実行
if (require.main === module) {
  transferGovernanceWithFoundation()
    .then(() => {
      console.log("Script completed successfully");
      process.exit(0);
    })
    .catch((error) => {
      console.error("Script failed:", error);
      process.exit(1);
    });
}

export { transferGovernanceWithFoundation };
