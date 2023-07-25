require("dotenv").config();
import { readFileSync, writeFileSync, unlinkSync, existsSync } from "fs";
import { Wallet, Signer, getDefaultProvider, Contract } from "ethers";
import { genABI } from "../src/genABI";
import { getLatestContractName } from "../src/upgradeUtil";
import { isConstructSignatureDeclaration } from "typescript";
import {
  DeploymentsExtension,
  DeploymentSubmission,
} from "hardhat-deploy/types";
import { execSync } from "child_process";
const addressExp =
  /address public constant factory = address\(0x([0-9a-fA-F]{40})\);/;
const EMBEDDED_MODE_FILE = ".embeddedMode";

export function hardcodeFactoryAddress(filename, address) {
  let path = `contracts/${filename}.sol`;
  let tmp = readFileSync(path)
    .toString()
    .replace(
      addressExp,
      `address public constant factory = address(${address});`
    );
  writeFileSync(path, tmp);
}

export function goToEmbededMode() {
  writeFileSync(EMBEDDED_MODE_FILE, "");
  console.log(
    `\n${EMBEDDED_MODE_FILE} is created. Factory Address is from ${getLocalFactoryAddress()} to ${extractEmbeddedFactoryAddress(
      "BulksaleV1"
    )}. Now this command is embedded mode.\n`
  );
}
export function getLocalFactoryAddress() {
  return process.env.LOCAL_FACTORY_ADDERSS;
}
export function isEmbeddedMode() {
  return existsSync(EMBEDDED_MODE_FILE);
}
export function isInitMode() {
  return !isEmbeddedMode();
}

export function recoverFactoryAddress(filename) {
  let path = `contracts/${filename}.sol`;
  const localAddress = getLocalFactoryAddress();
  let tmp = readFileSync(path)
    .toString()
    .replace(
      addressExp,
      `address public constant factory = address(${localAddress});`
    );
  writeFileSync(path, tmp);
  console.log(
    `deployUtil.recoverFactoryAddress() ... Embedded address is back to ${localAddress} for ${filename}`
  );
}
export function backToInitMode() {
  const localAddress = getLocalFactoryAddress();
  try {
    unlinkSync(EMBEDDED_MODE_FILE);
  } catch (e) {
    console.log(e.message);
  }
  console.log(
    `\n${EMBEDDED_MODE_FILE} is deleted. Now this command is initial mode. ${localAddress} is on the contract-hard-coded-value.\n`
  );
}

export function extractEmbeddedFactoryAddress(filename) {
  let path = `contracts/${filename}.sol`;
  let group = readFileSync(path).toString().match(addressExp);
  return `0x${group[1]}`;
}

type LibraryList = "PledgeLib" | "SafeMath";
type Options = {
  from?: Signer | undefined;
  signer?: Signer | undefined;
  ABI?: any | undefined;
  args?: Array<any> | undefined;
  libraries?: { [key in LibraryList]?: string } | undefined;
  log?: boolean | undefined;
  getContractFactory: any;
  deployments: DeploymentsExtension;
  gasLimit?: number | undefined;
  gasPrice?: number | undefined;
  maxPriorityFeePerGas?: number | undefined;
  maxFeePerGas?: number | undefined;
  nonce?: number | undefined;
  tag?: string | undefined;
  isDependency?: boolean | undefined;
};

let network;
export function setNetwork(_network) {
  network = _network;
}
export function getCurrentNetwork() {
  if (network) return network;
  if (process.argv.join("").toLowerCase().indexOf("goerli") >= 0) {
    return "goerli";
  } else if (process.argv.join("").toLowerCase().indexOf("sepolia") >= 0) {
    return "sepolia";
  } else if (process.argv.join("").toLowerCase().indexOf("mainnet") >= 0) {
    return "mainnet";
  } else {
    return "localhost";
  }
  // node hardhat deploy --network <network> / npm run verify:goerli:all
}
export function setProvider() {
  let network;
  if (getCurrentNetwork() == "localhost") {
    network = "http://localhost:8545";
  } else {
    network = getCurrentNetwork();
  }
  const provider = getDefaultProvider(network, {
    etherscan: process.env.ETHERSCAN_API_KEY,
    infura: process.env.INFURA_API_TOKEN,
    alchemy: process.env.ALCHEMY_API_TOKEN,
  });
  return singletonProvider(provider);
}
export async function deploy(contractName: string, opts: Options) {
  const foundation: Signer = getFoundation();
  const deployer: Signer = getDeployer();

  if (!opts.from) opts.from = foundation;
  if (!opts.signer) opts.signer = opts.from;
  if (!opts.args) opts.args = [];
  if (!opts.log) opts.log = true;
  if (!opts.gasLimit) opts.gasLimit = 15000000; // Yay, after London!
  if (!opts.gasPrice) opts.gasPrice = 20;
  if (!opts.maxPriorityFeePerGas) opts.maxPriorityFeePerGas = 100;
  if (!opts.maxFeePerGas) opts.maxFeePerGas = 2000;
  if (!opts.nonce) opts.nonce = await opts.from.getTransactionCount("pending");
  if (!opts.tag) opts.tag = "";
  if (!opts.isDependency) opts.isDependency = false;
  if (!opts.ABI) opts.ABI = genABI(contractName, opts.isDependency);

  let _opt: any = {
    signer: opts.signer,
  };

  if (opts.libraries) _opt.libraries = opts.libraries;

  const _Factory = await opts.getContractFactory(contractName, _opt);

  const _Contract: Contract = await _Factory.deploy(...opts.args, {
    gasLimit: opts.gasLimit,
    // maxPriorityFeePerGas: opts.maxPriorityFeePerGas,
    // maxFeePerGas: opts.maxFeePerGas,
    // nonce: opts.nonce
  });
  const tx = _Contract.deployTransaction;
  console.log(`Waiting for ${contractName} deployTx...`);
  let res = await tx.wait().catch((e) => console.log(e.message));
  if (!res) throw new Error(`The deployment of ${contractName} is failed.`);

  writeFileSync(
    getDeploymentAddressPathWithTag(contractName, opts.tag),
    _Contract.address
  );

  let contract: Contract = new Contract(_Contract.address, opts.ABI, provider);

  if (opts.log)
    console.log(
      `${contractName} is deployed as ${
        _Contract.address
      } by ${await _Contract.signer.getAddress()} on ${
        (await provider.getNetwork()).name
      } at ${await provider.getBlockNumber()} and nonce ${opts.nonce}`
    );

  let _signedContract: Contract = contract.connect(<Signer>opts.signer);

  return _signedContract;
}
function _getDeploymentAddressPathWithTag(contractName: string, tag: string) {
  return `./deployments/${getCurrentNetwork()}/${contractName}${tag}`;
}
export function getDeploymentAddressPath(contractName: string) {
  return _getDeploymentAddressPathWithTag(contractName, "");
}
export function getDeploymentAddressPathWithTag(
  contractName: string,
  tag: string
) {
  return _getDeploymentAddressPathWithTag(contractName, tag);
}

export function verifyWithEtherscan() {
  console.log("=== Fetching local addresses");

  let ChainLinkEthUsd = readFileSync(
    getDeploymentAddressPathWithTag("ChainLinkMock", "EthUsd")
  ).toString();
  let ChainLinkJpyUsd = readFileSync(
    getDeploymentAddressPathWithTag("ChainLinkMock", "JpyUsd")
  ).toString();
  let Tellor = readFileSync(
    getDeploymentAddressPath("TellorCallerMock")
  ).toString();
  let PriceFeedUUPSImpl = readFileSync(
    getDeploymentAddressPathWithTag("PriceFeed", "UUPSImpl")
  ).toString();
  let CJPY = readFileSync(getDeploymentAddressPath("CJPY")).toString();
  let FeePoolUUPSImpl = readFileSync(
    getDeploymentAddressPathWithTag("FeePool", "UUPSImpl")
  ).toString();
  let CurrencyOSUUPSImpl = readFileSync(
    getDeploymentAddressPathWithTag("CurrencyOS", "UUPSImpl")
  ).toString();
  let YamatoUUPSImpl = readFileSync(
    getDeploymentAddressPathWithTag("Yamato", "UUPSImpl")
  ).toString();

  let YamatoDepositorUUPSImpl = readFileSync(
    getDeploymentAddressPathWithTag("YamatoDepositor", "UUPSImpl")
  ).toString();
  let YamatoBorrowerUUPSImpl = readFileSync(
    getDeploymentAddressPathWithTag("YamatoBorrower", "UUPSImpl")
  ).toString();
  let YamatoRepayerUUPSImpl = readFileSync(
    getDeploymentAddressPathWithTag("YamatoRepayer", "UUPSImpl")
  ).toString();
  let YamatoWithdrawerUUPSImpl = readFileSync(
    getDeploymentAddressPathWithTag("YamatoWithdrawer", "UUPSImpl")
  ).toString();
  let YamatoRedeemerUUPSImpl = readFileSync(
    getDeploymentAddressPathWithTag("YamatoRedeemer", "UUPSImpl")
  ).toString();
  let YamatoSweeperUUPSImpl = readFileSync(
    getDeploymentAddressPathWithTag("YamatoSweeper", "UUPSImpl")
  ).toString();

  let PoolUUPSImpl = readFileSync(
    getDeploymentAddressPathWithTag("Pool", "UUPSImpl")
  ).toString();
  let PriorityRegistryUUPSImpl = readFileSync(
    getDeploymentAddressPathWithTag("PriorityRegistry", "UUPSImpl")
  ).toString();
  let PledgeLib = readFileSync(
    getDeploymentAddressPath("PledgeLib")
  ).toString();

  console.log("=== Verify started");

  try {
    execSync(
      `npm run verify:goerli -- --contract contracts/ChainLinkMock.sol:ChainLinkMock ${ChainLinkEthUsd} ETH/USD`
    );
  } catch (e) {
    console.log(e.message);
  }
  try {
    execSync(
      `npm run verify:goerli -- --contract contracts/ChainLinkMock.sol:ChainLinkMock ${ChainLinkJpyUsd} JPY/USD`
    );
    execSync(
      `npm run verify:goerli -- --contract contracts/TellorCallerMock.sol:TellorCallerMock ${Tellor}`
    );
  } catch (e) {
    console.log(e.message);
  }

  try {
    let name = getLatestContractName("PriceFeed");
    console.log(name);
    execSync(
      `npm run verify:goerli -- --contract contracts/${name}.sol:${name} ${PriceFeedUUPSImpl}`
    );
  } catch (e) {
    console.log(
      `Etherscan Verification of PriceFeed.sol is failed. Maybe because of oz-upgrades reusing unused impl. (message: ${e.message})`
    );
  }

  try {
    execSync(
      `npm run verify:goerli -- --contract contracts/CJPY.sol:CJPY ${CJPY}`
    );
  } catch (e) {
    console.log(e.message);
  }
  try {
    let name = getLatestContractName("FeePool");
    execSync(
      `npm run verify:goerli -- --contract contracts/${name}.sol:${name} ${FeePoolUUPSImpl}`
    );
  } catch (e) {
    console.log(
      `Etherscan Verification of FeePool.sol is failed. Maybe because of oz-upgrades reusing unused impl. (message: ${e.message})`
    );
  }
  try {
    let name = getLatestContractName("CurrencyOS");
    execSync(
      `npm run verify:goerli -- --contract contracts/${name}.sol:${name} ${CurrencyOSUUPSImpl}`
    );
  } catch (e) {
    console.log(
      `Etherscan Verification of CurrencyOS.sol is failed. Maybe because of oz-upgrades reusing unused impl. (message: ${e.message})`
    );
  }

  try {
    let name = getLatestContractName("Yamato");
    execSync(
      `npm run verify:goerli -- --contract contracts/${name}.sol:${name} ${YamatoUUPSImpl}`
    );
  } catch (e) {
    console.log(
      `Etherscan Verification of Yamato.sol is failed. Maybe because of oz-upgrades reusing unused impl. (message: ${e.message})`
    );
  }

  try {
    let name = getLatestContractName("YamatoDepositor");
    execSync(
      `npm run verify:goerli -- --contract contracts/${name}.sol:${name} ${YamatoDepositorUUPSImpl}`
    );
  } catch (e) {
    console.log(
      `Etherscan Verification of YamatoDepositor.sol is failed. Maybe because of oz-upgrades reusing unused impl. (message: ${e.message})`
    );
  }
  try {
    let name = getLatestContractName("YamatoBorrower");
    execSync(
      `npm run verify:goerli -- --contract contracts/${name}.sol:${name} ${YamatoBorrowerUUPSImpl}`
    );
  } catch (e) {
    console.log(
      `Etherscan Verification of YamatoBorrower.sol is failed. Maybe because of oz-upgrades reusing unused impl. (message: ${e.message})`
    );
  }
  try {
    let name = getLatestContractName("YamatoRepayer");
    execSync(
      `npm run verify:goerli -- --contract contracts/${name}.sol:${name} ${YamatoRepayerUUPSImpl}`
    );
  } catch (e) {
    console.log(
      `Etherscan Verification of YamatoRepayer.sol is failed. Maybe because of oz-upgrades reusing unused impl. (message: ${e.message})`
    );
  }
  try {
    let name = getLatestContractName("YamatoWithdrawer");
    execSync(
      `npm run verify:goerli -- --contract contracts/${name}.sol:${name} ${YamatoWithdrawerUUPSImpl}`
    );
  } catch (e) {
    console.log(
      `Etherscan Verification of YamatoWithdrawer.sol is failed. Maybe because of oz-upgrades reusing unused impl. (message: ${e.message})`
    );
  }
  try {
    let name = getLatestContractName("YamatoRedeemer");
    execSync(
      `npm run verify:goerli -- --contract contracts/${name}.sol:${name} ${YamatoRedeemerUUPSImpl}`
    );
  } catch (e) {
    console.log(
      `Etherscan Verification of YamatoRedeemer.sol is failed. Maybe because of oz-upgrades reusing unused impl. (message: ${e.message})`
    );
  }
  try {
    let name = getLatestContractName("YamatoSweeper");
    execSync(
      `npm run verify:goerli -- --contract contracts/${name}.sol:${name} ${YamatoSweeperUUPSImpl}`
    );
  } catch (e) {
    console.log(
      `Etherscan Verification of YamatoSweeper.sol is failed. Maybe because of oz-upgrades reusing unused impl. (message: ${e.message})`
    );
  }
  try {
    let name = getLatestContractName("Pool");
    execSync(
      `npm run verify:goerli -- --contract contracts/${name}.sol:${name} ${PoolUUPSImpl}`
    );
  } catch (e) {
    console.log(e.message);
  }
  try {
    let name = getLatestContractName("PriorityRegistry");
    execSync(
      `npm run verify:goerli -- --contract contracts/${name}.sol:${name} ${PriorityRegistryUUPSImpl}`
    );
  } catch (e) {
    console.log(e.message);
  }
  try {
    execSync(
      `npm run verify:goerli -- --contract contracts/Dependencies/PledgeLib.sol:PledgeLib ${PledgeLib}`
    );
  } catch (e) {
    console.log(e.message);
  }

  showProxyVerificationURLs();

  console.log("=== Verify ended");
}
function _getIsThisAProxyURL(_proxyURL) {
  return `https://${getCurrentNetwork()}.etherscan.io/proxyContractChecker?a=${_proxyURL}`;
}
function _logProxyProcedure(proxyAddr) {
  console.log(
    `Open ${_getIsThisAProxyURL(
      proxyAddr
    )} and continue heuristic "Read as Proxy" configuration. Read more: https://medium.com/etherscan-blog/and-finally-proxy-contract-support-on-etherscan-693e3da0714b`
  );
}
export function showProxyVerificationURLs() {
  let YamatoERC1967Proxy = readFileSync(
    getDeploymentAddressPathWithTag("Yamato", "ERC1967Proxy")
  ).toString();
  let YamatoDepositorERC1967Proxy = readFileSync(
    getDeploymentAddressPathWithTag("YamatoDepositor", "ERC1967Proxy")
  ).toString();
  let YamatoBorrowerERC1967Proxy = readFileSync(
    getDeploymentAddressPathWithTag("YamatoBorrower", "ERC1967Proxy")
  ).toString();
  let YamatoRepayerERC1967Proxy = readFileSync(
    getDeploymentAddressPathWithTag("YamatoRepayer", "ERC1967Proxy")
  ).toString();
  let YamatoWithdrawerERC1967Proxy = readFileSync(
    getDeploymentAddressPathWithTag("YamatoWithdrawer", "ERC1967Proxy")
  ).toString();
  let YamatoRedeemerERC1967Proxy = readFileSync(
    getDeploymentAddressPathWithTag("YamatoRedeemer", "ERC1967Proxy")
  ).toString();
  let YamatoSweeperERC1967Proxy = readFileSync(
    getDeploymentAddressPathWithTag("YamatoSweeper", "ERC1967Proxy")
  ).toString();
  let PoolERC1967Proxy = readFileSync(
    getDeploymentAddressPathWithTag("Pool", "ERC1967Proxy")
  ).toString();
  let PriorityRegistryERC1967Proxy = readFileSync(
    getDeploymentAddressPathWithTag("PriorityRegistry", "ERC1967Proxy")
  ).toString();
  let PriceFeedERC1967Proxy = readFileSync(
    getDeploymentAddressPathWithTag("PriceFeed", "ERC1967Proxy")
  ).toString();
  let FeePoolERC1967Proxy = readFileSync(
    getDeploymentAddressPathWithTag("FeePool", "ERC1967Proxy")
  ).toString();
  let CurrencyOSERC1967Proxy = readFileSync(
    getDeploymentAddressPathWithTag("CurrencyOS", "ERC1967Proxy")
  ).toString();

  _logProxyProcedure(YamatoERC1967Proxy);
  _logProxyProcedure(YamatoDepositorERC1967Proxy);
  _logProxyProcedure(YamatoBorrowerERC1967Proxy);
  _logProxyProcedure(YamatoRepayerERC1967Proxy);
  _logProxyProcedure(YamatoWithdrawerERC1967Proxy);
  _logProxyProcedure(YamatoRedeemerERC1967Proxy);
  _logProxyProcedure(YamatoSweeperERC1967Proxy);
  _logProxyProcedure(PoolERC1967Proxy);
  _logProxyProcedure(PriorityRegistryERC1967Proxy);
  _logProxyProcedure(PriceFeedERC1967Proxy);
  _logProxyProcedure(FeePoolERC1967Proxy);
  _logProxyProcedure(CurrencyOSERC1967Proxy);
}

let provider;
export function singletonProvider(_provider: any | undefined = undefined) {
  if (!provider) provider = _provider;
  return provider;
}

export function getFoundation(): Signer {
  return new Wallet(process.env.FOUNDATION_PRIVATE_KEY, singletonProvider());
}
export function getDeployer(): Signer {
  return new Wallet(process.env.DEPLOYER_PRIVATE_KEY, singletonProvider());
}

export async function sleep(n) {
  return new Promise((resolve) => setTimeout(resolve, n));
}

export async function existsSlot(provider, address, slot) {
  return (await provider.getStorageAt(address, slot)).length > 2;
}
