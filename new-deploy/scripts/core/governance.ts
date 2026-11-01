import hre from 'hardhat';
import { encodeFunctionData, getAddress, type Abi, type Address } from 'viem';
import { getNetworkConfig, type NetworkName } from '../../config/networks';
import { createAndProposeSafeTransaction, findPendingSafeTransaction } from './safe-transaction';

/** localhost でマルチシグの代わりに使うアカウント（Anvil のアカウント #1） */
const LOCALHOST_MULTISIG: Address = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';

const GOVERNANCE_ABI = [
  { type: 'function', name: 'governance', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'pendingGovernance', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
] as const;

export type GovernanceState = {
  governance: Address;
  pendingGovernance: Address;
};

export type ContractCall = {
  network: NetworkName;
  address: Address;
  abi: Abi;
  functionName: string;
  args?: readonly unknown[];
};

/**
 * - sent: 送信して確定した
 * - proposed: Safe に提案した
 * - already-proposed: 同じ内容の未実行の提案が Safe にあるため、提案しなかった
 */
export type SendResult = 'sent' | 'proposed' | 'already-proposed';

type WalletClient = Awaited<ReturnType<typeof hre.viem.getWalletClients>>[number];

export function getMultisigAddress(network: NetworkName): Address {
  if (network === 'localhost') return LOCALHOST_MULTISIG;
  const safeAddress = getNetworkConfig(network).safeAddress;
  if (!safeAddress) {
    throw new Error(`SAFE_ADDRESS_${network.toUpperCase()} is not set in .env`);
  }
  return getAddress(safeAddress);
}

export async function getDeployerAddress(): Promise<Address> {
  const [deployer] = await hre.viem.getWalletClients();
  return getAddress(deployer.account.address);
}

export async function readGovernance(address: Address): Promise<GovernanceState> {
  const publicClient = await hre.viem.getPublicClient();
  const [governance, pendingGovernance] = await Promise.all([
    publicClient.readContract({ address, abi: GOVERNANCE_ABI, functionName: 'governance' }),
    publicClient.readContract({ address, abi: GOVERNANCE_ABI, functionName: 'pendingGovernance' }),
  ]);
  return {
    governance: getAddress(governance),
    pendingGovernance: getAddress(pendingGovernance),
  };
}

/** デプロイ用アカウント（ウォレット #0）から送信する */
export async function sendFromDeployer(call: ContractCall): Promise<SendResult> {
  const [deployer] = await hre.viem.getWalletClients();
  return sendFrom(deployer, call);
}

/**
 * マルチシグから実行する。
 * localhost ではアカウント #1 から直接送信し、それ以外では Safe に提案する。
 * 宛先と calldata が同じ未実行の提案が Safe にあれば、提案しない。
 */
export async function sendFromMultisig(call: ContractCall): Promise<SendResult> {
  if (call.network === 'localhost') {
    const [, multisig] = await hre.viem.getWalletClients();
    return sendFrom(multisig, call);
  }

  const data = encodeFunctionData({
    abi: call.abi,
    functionName: call.functionName,
    args: call.args ?? [],
  } as Parameters<typeof encodeFunctionData>[0]);
  const pending = await findPendingSafeTransaction(call.address, data, call.network);
  if (pending) {
    console.log(`   ⏭️  Already proposed (Safe nonce ${pending.nonce}, ${pending.safeTxHash})`);
    return 'already-proposed';
  }

  await createAndProposeSafeTransaction(
    call.address,
    call.abi,
    call.functionName,
    [...(call.args ?? [])],
    call.network
  );
  return 'proposed';
}

/**
 * 現在の governance を持つ側から実行する。
 * デプロイ用アカウントなら直接送信し、マルチシグなら sendFromMultisig で実行する。
 */
export async function sendAsGovernance(call: ContractCall): Promise<SendResult> {
  const { governance } = await readGovernance(call.address);
  const deployer = await getDeployerAddress();
  const multisig = getMultisigAddress(call.network);

  if (governance === deployer) return sendFromDeployer(call);
  if (governance === multisig) return sendFromMultisig(call);
  throw new Error(
    `governance of ${call.address} is ${governance}, which is neither the deployer (${deployer}) nor the multisig (${multisig})`
  );
}

async function sendFrom(walletClient: WalletClient, call: ContractCall): Promise<SendResult> {
  const publicClient = await hre.viem.getPublicClient();
  const hash = await walletClient.writeContract({
    address: call.address,
    abi: call.abi,
    functionName: call.functionName,
    args: call.args ?? [],
  } as Parameters<WalletClient['writeContract']>[0]);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== 'success') {
    throw new Error(`${call.functionName} reverted (tx ${hash})`);
  }
  console.log(`   📝 Transaction hash: ${hash}`);
  console.log(`   ✅ Confirmed in block ${receipt.blockNumber}`);
  return 'sent';
}
