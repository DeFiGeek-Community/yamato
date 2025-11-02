// viem v2 系
import { readFileSync, writeFileSync } from "fs";
import {
  createPublicClient,
  createWalletClient,
  http,
  type Hex,
  type Address,
  type Abi,
  type Chain,
  encodeFunctionData,
  getAddress,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { mainnet, sepolia, localhost } from "viem/chains";
import { ethers } from "hardhat";
import type { BaseContract, ContractFactory } from "ethers";
import {
  setNetwork,
} from "../src/deployUtil";

// あなたのユーティリティ
import { getDeploymentAddressPathWithTag, getCurrentNetwork } from "./deployUtil";
// 既存の ethers 側ライブラリデプロイを使うなら残す（viem化も下に別関数例あり）
import { deployLibrary as deployLibraryEthers } from "./testUtil";

// ──────────────────────────────
// カスタム localhost (31337)
// ──────────────────────────────
const localhost31337: Chain = {
  ...localhost,
  id: 31337,
  name: "Localhost",
  network: "localhost",
  rpcUrls: {
    default: { http: ["http://127.0.0.1:8545"] },
    public: { http: ["http://127.0.0.1:8545"] },
  },
};

// ネットワーク選択
export function getChain(): Chain {
  const n = process.env.NETWORK // "mainnet" | "sepolia" | "localhost" | "hardhat" 等
  if (n === "mainnet") return mainnet;
  if (n === "sepolia") return sepolia;
  if (n === "localhost" || n === "hardhat") return localhost31337;
  return mainnet;
}

// EIP-1559/legacy を吸収して手数料を決める
async function withFees(
  publicClient: ReturnType<typeof createPublicClient>,
  overrides?: { gas?: bigint; gasPrice?: bigint; maxFeePerGas?: bigint; maxPriorityFeePerGas?: bigint }
) {
  if (overrides?.gasPrice || (overrides?.maxFeePerGas && overrides?.maxPriorityFeePerGas)) {
    return overrides;
  }
  // まず EIP-1559 を試す
  try {
    const fees = await publicClient.estimateFeesPerGas();
    return {
      maxFeePerGas: overrides?.maxFeePerGas ?? fees.maxFeePerGas,
      maxPriorityFeePerGas: overrides?.maxPriorityFeePerGas ?? fees.maxPriorityFeePerGas,
      gas: overrides?.gas,
    };
  } catch {
    // fallback: legacy
    const gasPrice = await publicClient.getGasPrice();
    return { gasPrice: overrides?.gasPrice ?? gasPrice, gas: overrides?.gas };
  }
}

// Hardhat artifact を読み込む
export function readArtifact(path: string): { abi: Abi; bytecode: Hex; linkReferences?: any } {
  const raw = JSON.parse(readFileSync(path, "utf8"));
  return { abi: raw.abi as Abi, bytecode: raw.bytecode as Hex, linkReferences: raw.linkReferences };
}

// linkReferences を使って bytecode にライブラリアドレスを埋め込む
function linkBytecodeByReferences(bytecode: Hex, linkReferences: any, libMap: Record<string, Address>): Hex {
  let code = bytecode as string;
  for (const [, fileRefs] of Object.entries<any>(linkReferences ?? {})) {
    for (const [libName, fixups] of Object.entries<any>(fileRefs)) {
      const addr = libMap[libName];
      if (!addr) continue;
      const addrStr = addr.toLowerCase();
      for (const fixup of fixups) {
        code =
          code.substring(0, 2 + fixup.start * 2) +
          addrStr.substring(2) +
          code.substring(2 + (fixup.start + fixup.length) * 2);
      }
    }
  }
  return code as Hex;
}

// （必要なら）viem でライブラリをデプロイする例
// 既に deployLibraryEthers があるならそれでもOK
async function deployLibraryWithViem(
  name: string,
  publicClient: ReturnType<typeof createPublicClient>,
  walletClient: ReturnType<typeof createWalletClient>,
): Promise<Address> {
  const chain = getChain();
  const p = `./artifacts/contracts/${name}.sol/${name}.json`;
  const { abi, bytecode } = readArtifact(p);
  const hash = await walletClient.deployContract({ chain, abi, bytecode });
  const rcpt = await publicClient.waitForTransactionReceipt({ hash, confirmations: 1 });
  if (!rcpt.contractAddress) throw new Error(`Library ${name} deployment failed`);
  return rcpt.contractAddress as Address;
}

// ──────────────────────────────
// UUPS 実装 + ERC1967Proxy を viem で完全デプロイ
// （ethers の戻り値にしない）
// ──────────────────────────────
export async function deployUUPSProxyWithViem<
  T extends BaseContract,
  S extends ContractFactory
>(
  contractNameTo: string,
  libraries?: string[],
  args?: readonly unknown[],
  overrides?: { gas?: bigint; gasPrice?: bigint; maxFeePerGas?: bigint; maxPriorityFeePerGas?: bigint }
): Promise<T> {
  const chain = getChain();
  const network = getCurrentNetwork();

  const rpcUrl =
    network === "localhost" || network === "hardhat"
      ? "http://127.0.0.1:8545"
      : (process.env.ALCHEMY_URL as string);
  if (!rpcUrl) throw new Error("ALCHEMY_URL is not set");

  const pk = process.env.FOUNDATION_PRIVATE_KEY;
  if (!pk) throw new Error("FOUNDATION_PRIVATE_KEY is not set");

  const transport = http(rpcUrl);
  const publicClient = createPublicClient({ chain, transport });
  const account = privateKeyToAccount(("0x" + pk.replace(/^0x/, "")) as Hex);
  const walletClient = createWalletClient({ chain, transport, account });

  // 1) Implementation をデプロイ
  const implArtifactPath = `./artifacts/contracts/${contractNameTo}.sol/${contractNameTo}.json`;
  const implArtifact = readArtifact(implArtifactPath);
  let implBytecode = implArtifact.bytecode;

  if (libraries && libraries.length > 0 && implArtifact.linkReferences) {
    const libAddrMap: Record<string, Address> = {};
    for (const libName of libraries) {
      // 既存の ethers 版を使う場合
      const lib = await deployLibraryEthers(libName);
      libAddrMap[libName] = getAddress(String(lib.address));
      // viem でやるなら ↓
      // libAddrMap[libName] = await deployLibraryWithViem(libName, publicClient, walletClient);
    }
    implBytecode = linkBytecodeByReferences(implBytecode, implArtifact.linkReferences, libAddrMap);
  }

  const implFee = await withFees(publicClient, overrides);
  const implHash = await walletClient.deployContract({
    chain,
    abi: implArtifact.abi,
    bytecode: implBytecode,
    ...implFee,
  });
  const implReceipt = await publicClient.waitForTransactionReceipt({ hash: implHash, confirmations: 1 });
  const implAddr = implReceipt.contractAddress as Address;
  if (!implAddr) throw new Error("Implementation deployment failed");
  console.log("contract.hash", implHash);
  console.log("contract.address", implAddr);

  // 2) initData
  let initData: Hex = "0x";
  console.log("args:", args);
  console.log("args.length:", args?.length);
  if (args && args.length > 0) {
    const hasInitialize = (implArtifact.abi as Abi).some(
      (f: any) => f?.type === "function" && f?.name === "initialize"
    );
    console.log("hasInitialize:", hasInitialize);
    if (hasInitialize) {
      try {
        initData = encodeFunctionData({
          abi: implArtifact.abi,
          functionName: "initialize",
          args,
        });
        console.log("initData:", initData);
        
        // 実装に対して通常のcallで初期化をシミュレーション
        console.log("Simulating initialize call on implementation...");
        try {
          const simResult = await publicClient.call({
            to: implAddr,
            data: initData,
            account: account.address,
          });
          console.log("Simulation successful:", simResult);
        } catch (simError) {
          console.error("Simulation failed - this is the root cause:", simError);
          throw simError;
        }
      } catch (error) {
        console.error("Failed to encode initialize function:", error);
        throw error;
      }
    } else {
      console.log("No initialize function found in ABI");
    }
  } else {
    console.log("No args provided, using empty initData");
  }

  // 3) ERC1967Proxy をデプロイ
  const proxyArtifactPath =
    `./artifacts/@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol/ERC1967Proxy.json`;
  const proxyArtifact = readArtifact(proxyArtifactPath);

  const proxyFee = await withFees(publicClient, overrides);
  const proxyHash = await walletClient.deployContract({
    chain,
    abi: proxyArtifact.abi,
    bytecode: proxyArtifact.bytecode,
    args: [implAddr, initData], // constructor(address _logic, bytes memory _data)
    ...proxyFee,
  });
  const proxyReceipt = await publicClient.waitForTransactionReceipt({ hash: proxyHash, confirmations: 1 });
  const proxyAddress = proxyReceipt.contractAddress as Address;
  if (!proxyAddress) throw new Error("Proxy deployment failed");
  console.log("proxy.hash", proxyHash);
  console.log("proxy.address", proxyAddress);

  // 4) ethers.js のコントラクトインスタンスを返却
  const inst = (await ethers.getContractAt(contractNameTo, proxyAddress)) as unknown as T;
  return inst;
}

// ──────────────────────────────
// 実装（Impl）のみデプロイして、UUPSImpl アドレスを保存
// ──────────────────────────────
export async function deployImplContractWithViem(
  implNameBase: string,
  usePledgeLib = false
): Promise<string> {
  const chain = getChain();
  const network = process.env.NETWORK;
  setNetwork(network);

  const rpcUrl =
    network === "localhost" || network === "hardhat"
      ? "http://127.0.0.1:8545"
      : (process.env.ALCHEMY_URL as string);
  if (!rpcUrl) throw new Error("ALCHEMY_URL is not set");

  const pk = process.env.FOUNDATION_PRIVATE_KEY;
  if (!pk) throw new Error("FOUNDATION_PRIVATE_KEY is not set");

  const transport = http(rpcUrl);
  const publicClient = createPublicClient({ chain, transport });
  const account = privateKeyToAccount(("0x" + pk.replace(/^0x/, "")) as Hex);
  const walletClient = createWalletClient({ chain, transport, account });

  const implArtifactPath = `./artifacts/contracts/${implNameBase}.sol/${implNameBase}.json`;
  const implArtifact = readArtifact(implArtifactPath);
  let implBytecode = implArtifact.bytecode;

  if (usePledgeLib && implArtifact.linkReferences) {
    const pledgeLibAddress = readFileSync(getDeploymentAddressPathWithTag("PledgeLib", ""))
      .toString()
      .trim(); // 改行トリム重要
    implBytecode = linkBytecodeByReferences(implBytecode, implArtifact.linkReferences, {
      PledgeLib: getAddress(pledgeLibAddress),
    });
  }

  const fees = await withFees(publicClient);

  const implHash = await walletClient.deployContract({
    chain,
    abi: implArtifact.abi,
    bytecode: implBytecode,
  });

  console.log(`Waiting for ${implNameBase} deployTx...`);
  const implReceipt = await publicClient.waitForTransactionReceipt({ hash: implHash, confirmations: 1 });
  const implAddr = implReceipt.contractAddress as Address;
  if (!implAddr) throw new Error(`${implNameBase} deployment failed`);
  console.log(`${implNameBase} deployed to:`, implAddr);

  // デプロイファイルへ保存
  const implNameWithoutVersion = implNameBase.replace(/V\d+$/, "");
  const implPath = getDeploymentAddressPathWithTag(implNameWithoutVersion, "UUPSImpl");
  writeFileSync(implPath, implAddr);

  return implAddr;
}
