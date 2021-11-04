require("dotenv").config();
import { readFileSync, writeFileSync, unlinkSync, existsSync } from "fs";
import { Wallet, Signer, getDefaultProvider, Contract } from "ethers";
import { genABI } from "../src/genABI";
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
    console.trace(e.message);
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

export function getCurrentNetwork() {
  return process.argv.join("").toLowerCase().indexOf("rinkeby") >= 0
    ? "rinkeby"
    : ""; // node hardhat deploy --network <network> / npm run verify:rinkeby:all
}
export function setProvider() {
  const provider = getDefaultProvider("rinkeby", {
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
  let res = await tx.wait().catch((e) => console.trace(e.message));
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
  let PriceFeedERC1967Proxy = readFileSync(
    getDeploymentAddressPathWithTag("PriceFeed", "ERC1967Proxy")
  ).toString();
  let PriceFeedUUPSImpl = readFileSync(
    getDeploymentAddressPathWithTag("PriceFeed", "UUPSImpl")
  ).toString();
  let CJPY = readFileSync(getDeploymentAddressPath("CJPY")).toString();
  let FeePoolERC1967Proxy = readFileSync(
    getDeploymentAddressPathWithTag("FeePool", "ERC1967Proxy")
  ).toString();
  let FeePoolUUPSImpl = readFileSync(
    getDeploymentAddressPathWithTag("FeePool", "UUPSImpl")
  ).toString();
  let CjpyOS = readFileSync(getDeploymentAddressPath("CjpyOS")).toString();
  let Yamato = readFileSync(getDeploymentAddressPath("Yamato")).toString();

  let YamatoERC1967Proxy = readFileSync(
    getDeploymentAddressPathWithTag("Yamato", "ERC1967Proxy")
  ).toString();
  let YamatoUUPSImpl = readFileSync(
    getDeploymentAddressPathWithTag("Yamato", "UUPSImpl")
  ).toString();
  let YamatoHelperERC1967Proxy = readFileSync(
    getDeploymentAddressPathWithTag("YamatoHelper", "ERC1967Proxy")
  ).toString();
  let YamatoHelperUUPSImpl = readFileSync(
    getDeploymentAddressPathWithTag("YamatoHelper", "UUPSImpl")
  ).toString();

  let Pool = readFileSync(getDeploymentAddressPath("Pool")).toString();
  let PriorityRegistry = readFileSync(
    getDeploymentAddressPath("PriorityRegistry")
  ).toString();
  let PledgeLib = readFileSync(
    getDeploymentAddressPath("PledgeLib")
  ).toString();

  console.log("=== Verify started");

  try {
    execSync(
      `npm run verify:rinkeby -- --contract contracts/ChainLinkMock.sol:ChainLinkMock ${ChainLinkEthUsd} ETH/USD`
    );
  } catch (e) {
    console.trace(e.message);
  }
  try {
    execSync(
      `npm run verify:rinkeby -- --contract contracts/ChainLinkMock.sol:ChainLinkMock ${ChainLinkJpyUsd} JPY/USD`
    );
    execSync(
      `npm run verify:rinkeby -- --contract contracts/TellorCallerMock.sol:TellorCallerMock ${Tellor}`
    );
  } catch (e) {
    console.trace(e.message);
  }

  try {
    execSync(
      `npm run verify:rinkeby -- --contract contracts/PriceFeed.sol:PriceFeed ${PriceFeedUUPSImpl} 2> /dev/null`
    );
    _logProxyProcedure(PriceFeedERC1967Proxy);
  } catch (e) {
    console.log(
      "Etherscan Verification of PriceFeed.sol is failed. Maybe because of oz-upgrades reusing unused impl."
    );
  }

  try {
    execSync(
      `npm run verify:rinkeby -- --contract contracts/CJPY.sol:CJPY ${CJPY}`
    );
  } catch (e) {
    console.trace(e.message);
  }
  try {
    execSync(
      `npm run verify:rinkeby -- --contract contracts/FeePool.sol:FeePool ${FeePoolUUPSImpl} 2> /dev/null`
    );
    _logProxyProcedure(FeePoolERC1967Proxy);
  } catch (e) {
    console.log(
      "Etherscan Verification of FeePool.sol is failed. Maybe because of oz-upgrades reusing unused impl."
    );
  }
  try {
    execSync(
      `npm run verify:rinkeby -- --contract contracts/CjpyOS.sol:CjpyOS ${CjpyOS} ${CJPY} ${PriceFeedERC1967Proxy} ${FeePoolERC1967Proxy}`
    );
  } catch (e) {
    console.trace(e.message);
  }

  try {
    execSync(
      `npm run verify:rinkeby -- --contract contracts/Yamato.sol:Yamato ${YamatoUUPSImpl} 2> /dev/null`
    );
    _logProxyProcedure(YamatoERC1967Proxy);
  } catch (e) {
    console.log(
      "Etherscan Verification of Yamato.sol is failed. Maybe because of oz-upgrades reusing unused impl."
    );
  }

  try {
    execSync(
      `npm run verify:rinkeby -- --contract contracts/Yamato.sol:Yamato ${YamatoHelperUUPSImpl} 2> /dev/null`
    );
    _logProxyProcedure(YamatoHelperERC1967Proxy);
  } catch (e) {
    console.log(
      "Etherscan Verification of YamatoHelper.sol is failed. Maybe because of oz-upgrades reusing unused impl."
    );
  }

  try {
    execSync(
      `npm run verify:rinkeby -- --contract contracts/Pool.sol:Pool ${Pool} ${YamatoHelperERC1967Proxy}`
    );
  } catch (e) {
    console.trace(e.message);
  }
  try {
    execSync(
      `npm run verify:rinkeby -- --contract contracts/PriorityRegistry.sol:PriorityRegistry ${PriorityRegistry} ${YamatoHelperERC1967Proxy}`
    );
  } catch (e) {
    console.trace(e.message);
  }
  try {
    execSync(
      `npm run verify:rinkeby -- --contract contracts/Dependencies/PledgeLib.sol:PledgeLib ${PledgeLib}`
    );
  } catch (e) {
    console.trace(e.message);
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
  let YamatoHelperERC1967Proxy = readFileSync(
    getDeploymentAddressPathWithTag("YamatoHelper", "ERC1967Proxy")
  ).toString();
  let PriceFeedERC1967Proxy = readFileSync(
    getDeploymentAddressPathWithTag("PriceFeed", "ERC1967Proxy")
  ).toString();
  let FeePoolERC1967Proxy = readFileSync(
    getDeploymentAddressPathWithTag("FeePool", "ERC1967Proxy")
  ).toString();

  _logProxyProcedure(YamatoERC1967Proxy);
  _logProxyProcedure(YamatoHelperERC1967Proxy);
  _logProxyProcedure(PriceFeedERC1967Proxy);
  _logProxyProcedure(FeePoolERC1967Proxy);
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
