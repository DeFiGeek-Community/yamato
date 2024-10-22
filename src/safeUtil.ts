import { ethers } from "ethers";
import Safe from "@safe-global/protocol-kit";
import SafeApiKit from "@safe-global/api-kit";
import { SafeTransactionDataPartial } from "@safe-global/safe-core-sdk-types";
import type { BaseContract } from "ethers";

interface Config {
  CHAIN_ID: bigint;
  RPC_URL: string;
  SIGNER_ADDRESS_PRIVATE_KEY: string;
  SAFE_ADDRESS: string;
}

const networkToChainId: { [key: string]: bigint } = {
  mainnet: BigInt(1),
  goerli: BigInt(5),
  sepolia: BigInt(11155111),
};

export async function createAndProposeTransaction(
  contractAddress: string,
  contractABI: any,
  functionName: string,
  args: any[] = []
) {
  const NETWORK_NAME = process.env.NETWORK;
  const chainId = networkToChainId[NETWORK_NAME];

  const config: Config = {
    CHAIN_ID: chainId,
    RPC_URL: process.env.ALCHEMY_URL || "",
    SIGNER_ADDRESS_PRIVATE_KEY: process.env.SIGNER_ADDRESS_PRIVATE_KEY || "",
    SAFE_ADDRESS: process.env.UUPS_PROXY_ADMIN_MULTISIG_ADDRESS || "",
  };
  const protocolKit = await Safe.init({
    provider: config.RPC_URL,
    signer: config.SIGNER_ADDRESS_PRIVATE_KEY,
    safeAddress: config.SAFE_ADDRESS,
  });

  const apiKit = new SafeApiKit({
    chainId: config.CHAIN_ID,
  });

  const provider = new ethers.providers.JsonRpcProvider(config.RPC_URL);
  const contract: BaseContract = new ethers.Contract(
    contractAddress,
    contractABI,
    provider
  );

  const data = contract.interface.encodeFunctionData(functionName, args);

  const safeTransactionData: SafeTransactionDataPartial = {
    to: contractAddress,
    value: "0",
    data: data,
  };
  const nextNonce = await apiKit.getNextNonce(config.SAFE_ADDRESS);

  const safeTransaction = await protocolKit.createTransaction({
    transactions: [safeTransactionData],
    options: { nonce: nextNonce },
  });

  const signerAddress =
    (await protocolKit.getSafeProvider().getSignerAddress()) || "0x";
  const safeTxHash = await protocolKit.getTransactionHash(safeTransaction);
  const signature = await protocolKit.signHash(safeTxHash);

  await apiKit.proposeTransaction({
    safeAddress: config.SAFE_ADDRESS,
    safeTransactionData: safeTransaction.data,
    safeTxHash,
    senderAddress: signerAddress,
    senderSignature: signature.data,
  });

  console.log("Proposed a transaction with Safe:", config.SAFE_ADDRESS);
  console.log("- safeTxHash:", safeTxHash);
  console.log("- Sender:", signerAddress);
  console.log("- Sender signature:", signature.data);
}
