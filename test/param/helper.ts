const { ethers, waffle } = require("hardhat");
import { BigNumber, Contract, Signer } from "ethers";
import { expect } from "chai";

// Helper function to impersonate an account
export async function startImpersonate(account: string) {
  await ethers.provider.send("hardhat_impersonateAccount", [account]);
  const impersonatedSigner = await ethers.provider.getSigner(account);

  // Send some ETH to the impersonated account for gas
  const [deployer] = await ethers.getSigners();
  await deployer.sendTransaction({
    to: account,
    value: ethers.utils.parseEther("1.0"),
  });

  return impersonatedSigner;
}

// Helper function to stop impersonating an account
export async function stopImpersonate(account: string) {
  await ethers.provider.send("hardhat_stopImpersonatingAccount", [account]);
}

// Helper function to check if an event was emitted with specific arguments
export async function expectEventEmitted(
  tx: ContractTransaction,
  eventName: string,
  expectedArgs: Object
) {
  const receipt = await tx.wait();
  const event = receipt.events?.find((e) => e.event === eventName);

  expect(event).to.not.be.undefined,
    `Expected event ${eventName} to be emitted`;

  if (expectedArgs) {
    for (const [key, value] of Object.entries(expectedArgs)) {
      expect(event.args[key]).to.equal(
        value,
        `Expected event argument ${key} to be ${value}`
      );
    }
  }
}

let provider;
export function getSharedProvider() {
  if (!provider) {
    provider = new waffle.provider();
  }
  return provider;
}
let signers;
export function getSharedSigners() {
  if (!signers) {
    signers = ethers.getSigners();
  }
  return signers;
}

export async function summon<T = Contract>(
  contractName: string,
  ABI: any,
  args: Array<any> = [],
  signer: Signer | undefined = undefined,
  linkings: Array<string> = []
): Promise<T> {
  return await _summon(
    contractName,
    ABI,
    !args ? [] : args,
    !signer ? undefined : signer,
    true,
    linkings
  );
}
export async function libDeploy<T = Contract>(
  contractName: string,
  signer: Signer | undefined = undefined
): Promise<T> {
  const _Factory = await ethers.getContractFactory(contractName, signer);
  const _Contract: T = await _Factory.deploy();
  return _Contract;
}
export async function create<T = Contract>(
  contractName: string,
  ABI: any,
  args: Array<any> = [],
  signer: Signer | undefined = undefined,
  linkings: Array<string> = []
): Promise<T> {
  return await _summon(
    contractName,
    ABI,
    !args ? [] : args,
    !signer ? undefined : signer,
    false,
    linkings
  );
}
let signedContracts = {};
export async function forge<T = Contract>(
  contractName: string,
  ABI: any,
  args: Array<any> = [],
  signer: Signer | undefined = undefined,
  linkings: Array<string> | undefined = undefined
): Promise<T> {
  const [first] = await getSharedSigners();
  if (!signer) {
    signer = first;
  }

  let libs = {};
  if (linkings) {
    await Promise.all(
      linkings.map(
        async (libName) => (libs[libName] = (await libDeploy(libName)).address)
      )
    );
  }
  const _Factory = await ethers.getContractFactory(contractName, {
    signer: signer,
    libraries: libs,
  });

  const _Contract = await _Factory.deploy(...args);
  return _Contract;
}
export async function _summon<T = Contract>(
  contractName: string,
  ABI: any,
  args: Array<any> = [],
  signer: Signer | undefined = undefined,
  singleton: boolean = true,
  linkings: Array<string>
): Promise<T> {
  let result;
  if (singleton && !!signedContracts[contractName]) {
    result = signedContracts[contractName];
  } else {
    const _Contract = await forge(
      contractName,
      ABI,
      !args ? [] : args,
      !signer ? undefined : signer,
      linkings
    );

    let contract = new ethers.Contract(
      _Contract.address,
      ABI,
      getSharedProvider()
    );

    let _signedContract: T = contract.connect(<Signer>signer);

    if (singleton) signedContracts[contractName] = _signedContract; // Don't save if one-time contract.

    result = _signedContract;
  }
  return result;
}

export function parseAddr(addr) {
  if (!addr) throw new Error("Error: helper.parseAddr(undefined)");
  return `0x${addr.slice(26, addr.length)}`;
}
export function parseBool(bytes) {
  return parseInt(bytes.slice(bytes.length - 1, bytes.length)) === 1;
}
export function parseInteger(bytes) {
  bytes = bytes.slice(2, bytes.length);
  return parseInt(bytes);
}

export async function getLogs(Contract: Contract, event, arg) {
  return Contract.queryFilter(
    Contract.filters[event](arg),
    0,
    (await getLatestBlock()).number
  );
}

const codec = new ethers.utils.AbiCoder();
export function encode(types, values) {
  return codec.encode(types, values);
}
export function decode(types, data) {
  return codec.decode(types, data);
}

export async function increaseTime(skipDuration: number) {
  const [first] = await getSharedSigners();
  first.provider.send("evm_increaseTime", [skipDuration]);
  first.provider.send("evm_mine");
}

export function toERC20(amount: string, decimal: number = 18): BigNumber {
  return ethers.utils.parseUnits(amount, decimal);
}
export function toFloat(amount: string, decimal: number = 18): string {
  return ethers.utils.formatUnits(amount, decimal);
}

export async function getLatestBlock() {
  const [first] = await getSharedSigners();
  const provider = first.provider;
  const blockNumber: number = await provider.getBlockNumber();
  const block = await provider.getBlock(blockNumber);
  return block;
}
export async function onChainNow() {
  const block = await getLatestBlock();
  return block.timestamp;
}
