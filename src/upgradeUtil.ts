import { ethers, upgrades, artifacts, defender } from "hardhat";
import { ExtendedProposalResponse } from "@openzeppelin/hardhat-defender/dist/propose-upgrade";
import { BaseContract, ContractFactory, BigNumber, BigNumberish } from "ethers";
import { getLinkedContractFactory, deployLibrary } from "./testUtil";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "fs";
import { getDeploymentAddressPathWithTag, setNetwork } from "./deployUtil";
import { execSync } from "child_process";
import { PriorityRegistry, PriorityRegistryV5 } from "../typechain";
import chalk from "chalk";

import type { Abi, Address, Hex } from "viem";
import { createPublicClient, createWalletClient, http, parseEther, Abi as AbiViem } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { localhost } from "viem/chains";
import { getChain } from "./viemUtil";

require("dotenv").config();

/*
  For single-person upgrade
*/
export async function upgradeProxy<
  T extends BaseContract,
  S extends ContractFactory
>(
  olderInstanceAddress: string,
  contractNameTo: string,
  libraries?: string[],
  options?: {
    call?: string | { fn: string; args?: unknown[] };
  }
): Promise<T> {
  let Libraries = {};
  if (libraries) {
    for (const libraryName of libraries) {
      Libraries[libraryName] = (await deployLibrary(libraryName)).address;
    }
  }

  let contractFactory: S;
  if (libraries?.length > 0) {
    contractFactory = <S>(
      await getLinkedContractFactory(contractNameTo, Libraries)
    );
  } else {
    contractFactory = <S>await ethers.getContractFactory(contractNameTo);
  }

  const upgradeOptions: any = {
    kind: "uups",
  };

  if (options?.call) {
    upgradeOptions.call = options.call;
  }

  if (libraries?.length > 0) {
    upgradeOptions.unsafeAllow = ["external-library-linking"];
  }
  const instance: T = <T>(
    await upgrades.upgradeProxy(
      olderInstanceAddress,
      contractFactory,
      upgradeOptions
    )
  );
  return instance;
}

export async function deployUUPSProxy<
  T extends BaseContract,
  S extends ContractFactory
>(
  contractNameTo: string,
  libraries?: string[],
  args?: any[],
): Promise<T> {
  let Libraries = {};
  if (libraries) {
    for (const libraryName of libraries) {
      Libraries[libraryName] = (await deployLibrary(libraryName)).address;
    }
  }

  let contractFactory: S;
  if (libraries?.length > 0) {
    contractFactory = <S>(
      await getLinkedContractFactory(contractNameTo, Libraries)
    );
  } else {
    contractFactory = <S>await ethers.getContractFactory(contractNameTo);
  }
  const contract = await contractFactory.deploy();
  console.log("contract.hash", contract.deployTransaction.hash);
  console.log("contract.address", contract.address);
  // ハッシュでTX確定を待機
  await ethers.provider.waitForTransaction(contract.deployTransaction.hash, 1);
  // await contract.deployed();

  const Proxy = await ethers.getContractFactory("ERC1967Proxy");
  let proxy;
  if(args){
    const initData = contractFactory.interface.encodeFunctionData("initialize", args);
    console.log("initData", initData);
    proxy = await Proxy.deploy(contract.address, initData);
    console.log("proxy.hash", proxy.deployTransaction.hash);
    // ハッシュでTX確定を待機
    await ethers.provider.waitForTransaction(proxy.deployTransaction.hash, 1);

  }else{
    proxy = await Proxy.deploy(contract.address, []);
    console.log("proxy.hash", proxy.deployTransaction.hash);
    console.log("proxy.address", proxy.address);
    // ハッシュでTX確定を待機
    await ethers.provider.waitForTransaction(proxy.deployTransaction.hash, 1);
  }
  // await proxy.deployed();
  const viaProxy = contract.attach(proxy.address);
  return viaProxy as T;
}

/*
  For multisig upgrade
*/
export async function proposeUpgradeProxy<
  T extends BaseContract,
  S extends ContractFactory
>(
  olderInstanceAddress: string,
  contractNameTo: string,
  multisigAddr: string,
  libraries?: string[],
  options?: {
    call?: string | { fn: string; args?: unknown[] };
  }
): Promise<ExtendedProposalResponse> {
  let Libraries = {};
  if (libraries) {
    for (const libraryName of libraries) {
      Libraries[libraryName] = (await deployLibrary(libraryName)).address;
    }
  }

  let contractFactory: S;
  if (libraries?.length > 0) {
    contractFactory = <S>(
      await getLinkedContractFactory(contractNameTo, Libraries)
    );
  } else {
    contractFactory = <S>await ethers.getContractFactory(contractNameTo);
  }

  const proposalOptions: any = {
    multisig: multisigAddr,
    kind: "uups",
  };

  if (options?.call) {
    proposalOptions.call = options.call;
  }

  if (libraries?.length > 0) {
    proposalOptions.unsafeAllow = ["external-library-linking"];
  }
  // console.log("prepareUpgrade")
  // console.log(
  //   await upgrades.prepareUpgrade(
  //     olderInstanceAddress,
  //     contractFactory,
  //     proposalOptions
  //     ))

  console.log("proposeUpgrade");
  const res: ExtendedProposalResponse = await defender.proposeUpgrade(
    olderInstanceAddress,
    contractFactory,
    proposalOptions
  );
  return res;
}

export async function runDowngrade(
  implNameBase: string,
  versionStr: string,
  linkings = []
) {
  const network = process.env.NETWORK;
  setNetwork(network);
  const filepath = getDeploymentAddressPathWithTag(
    implNameBase,
    "ERC1967Proxy"
  );
  if (!existsSync(filepath)) throw new Error(`${filepath} is not exist`);
  const ERC1967Proxy: string = readFileSync(filepath).toString();

  const implName = implNameBase + versionStr;
  if (implName.length == 0) {
    console.log(
      `./contracts/${implNameBase} only found. Set ./contracts/${implNameBase}V2 to start upgrading.`
    );
  } else {
    // console.log(`${implName} is going to be deployed to ERC1967Proxy...`);

    const inst = await upgradeProxy(ERC1967Proxy, implName, linkings);
    console.log(
      chalk.gray(
        `        [success] ${implName}=${inst.address} is upgraded to ERC1967Proxy`
      )
    );

    const implAddr = await (<any>inst).getImplementation();
    const implPath = getDeploymentAddressPathWithTag(implNameBase, "UUPSImpl");

    writeFileSync(implPath, implAddr);
    // console.log(`Saved ${implAddr} to ${implPath}`);

    try {
      if (network != "localhost") {
        execSync(
          `npm run verify:${network} -- --contract contracts/${implName}.sol:${implName} ${implAddr}`
        );
        console.log(`Verified ${implAddr}`);
      }
    } catch (e) {
      console.error(e.message);
    }
  }
}
export async function runUpgrade(
  implNameBase,
  linkings = [],
  options?: {
    call?: string | { fn: string; args?: unknown[] };
  }
) {
  const network = process.env.NETWORK;
  setNetwork(network);

  const filepath = getDeploymentAddressPathWithTag(
    implNameBase,
    "ERC1967Proxy"
  );
  if (!existsSync(filepath)) throw new Error(`${filepath} is not exist`);
  const ERC1967Proxy: string = readFileSync(filepath).toString();
  console.log(ERC1967Proxy);
  const implName = getLatestContractName(implNameBase);
  console.log(implName);
  if (implName.length == 0) {
    console.log(
      `./contracts/${implNameBase} only found. Set ./contracts/${implNameBase}V2 to start upgrading.`
    );
  } else {
    // console.log(`${implName} is going to be deployed to ERC1967Proxy...`);
    let multisigAddr = process.env.UUPS_PROXY_ADMIN_MULTISIG_ADDRESS;
    if (!multisigAddr) {
      const inst = await upgradeProxy(
        ERC1967Proxy,
        implName,
        linkings,
        options
      );
      console.log(
        chalk.gray(
          `        [success] ${implName}=${inst.address} is upgraded to ERC1967Proxy`
        )
      );

      const implAddr = await (<any>inst).getImplementation();

      try {
        if (network != "localhost") {
          execSync(
            `npm run verify:${network} -- --contract contracts/${implName}.sol:${implName} ${implAddr}`
          );
          console.log(`Verified ${implAddr}`);
        }
      } catch (e) {
        console.error(e.message);
      }

      const implPath = getDeploymentAddressPathWithTag(
        implNameBase,
        "UUPSImpl"
      );
      writeFileSync(implPath, implAddr);
    } else {
      const res = await proposeUpgradeProxy(
        ERC1967Proxy,
        implName,
        multisigAddr,
        linkings,
        options
      );

      console.log(res);
      console.log(res.verificationResponse);
      const implAddr = res.metadata.newImplementationAddress;

      const implPath = getDeploymentAddressPathWithTag(
        implNameBase,
        "UUPSImpl"
      );
      writeFileSync(implPath, implAddr);
    }
  }
}

export function getLatestContractName(implNameBase) {
  function regexpV(name) {
    if (name.indexOf(implNameBase) >= 0) {
      let target = name.slice(implNameBase.length, name.length);
      return target.match(/^V([0-9]+)\.sol/);
    } else {
      return null;
    }
  }

  const filenames = readdirSync("./contracts");
  const versions = filenames
    .filter((name) => regexpV(name))
    .map((matched) => parseInt(regexpV(matched)[1]));
  let highestVersion = Math.max(...versions);
  const implName = `${implNameBase}V${highestVersion}`;
  if (versions?.length == 0) {
    return implNameBase;
  } else {
    return implName;
  }
}

export async function upgradePriorityRegistryV2ToV5AndSync(
  PriorityRegistry: PriorityRegistry,
  pledges: {
    coll: BigNumberish;
    debt: BigNumberish;
    isCreated: boolean;
    owner: string;
    priority: BigNumberish;
  }[]
): Promise<PriorityRegistryV5> {
  const inst: PriorityRegistryV5 = <PriorityRegistryV5>(
    await upgradeProxy(PriorityRegistry.address, "PriorityRegistryV5", [
      "PledgeLib",
    ])
  );
  await inst.syncRankedQueue(pledges);
  return inst;
}

// 汎用的なトランザクション実行関数
export async function executeTransaction(
  contractAddress: string,
  contractABI: Abi,
  methodName: string,
  args: any[] = []
) {
  // .envからDEPLOYER_PRIVATE_KEYを読み込む
  const pk = process.env.LOCALHOST_ADMIN_PRIVATE_KEY;
  if (!pk) throw new Error("LOCALHOST_ADMIN_PRIVATE_KEY is not defined in .env");
  const chain = getChain();
  const account = privateKeyToAccount((pk.startsWith("0x") ? pk : `0x${pk}`) as Hex);
  const transport = http("http://127.0.0.1:8545");

  const publicClient = createPublicClient({ chain, transport });
  const walletClient = createWalletClient({ chain, transport, account });

  // 任意メソッド呼び出し（ethers の contract[methodName](...args) 相当）
  const hash = await walletClient.writeContract({
    chain,
    address: contractAddress as Address,
    abi: contractABI,
    functionName: methodName as any,          // 文字列名で指定
    args,
    account
  });

  // 取り込み（=1conf）まで待機（ethers の tx.wait() 相当）
  const receipt = await publicClient.waitForTransactionReceipt({ hash });

  console.log(
    `Executing method: ${methodName} on contract: ${contractAddress} with arguments:`,
    args
  );
  console.log("tx.hash:", hash);
  console.log("status:", receipt.status);
  return { hash, receipt };
}

// FOUNDATION_PRIVATE_KEYを使用するバージョン
export async function executeTransactionWithFoundation(
  contractAddress: string,
  contractABI: Abi,
  methodName: string,
  args: any[] = []
) {
  // .envからFOUNDATION_PRIVATE_KEYを読み込む
  const pk = process.env.FOUNDATION_PRIVATE_KEY;
  if (!pk) throw new Error("FOUNDATION_PRIVATE_KEY is not defined in .env");
  const chain = getChain();
  const account = privateKeyToAccount((pk.startsWith("0x") ? pk : `0x${pk}`) as Hex);
  
  // ネットワークに応じてRPC URLを設定
  const network = process.env.NETWORK;
  const rpcUrl = network === "localhost" || network === "hardhat"
    ? "http://127.0.0.1:8545"
    : (process.env.ALCHEMY_URL as string);
  if (!rpcUrl) throw new Error("ALCHEMY_URL is not set");
  
  const transport = http(rpcUrl);

  const publicClient = createPublicClient({ chain, transport });
  const walletClient = createWalletClient({ chain, transport, account });

  // 任意メソッド呼び出し（ethers の contract[methodName](...args) 相当）
  const hash = await walletClient.writeContract({
    chain,
    address: contractAddress as Address,
    abi: contractABI,
    functionName: methodName as any,          // 文字列名で指定
    args,
    account
  });

  // 取り込み（=1conf）まで待機（ethers の tx.wait() 相当）
  const receipt = await publicClient.waitForTransactionReceipt({ hash });

  console.log(
    `Executing method: ${methodName} on contract: ${contractAddress} with arguments:`,
    args
  );
  console.log("tx.hash:", hash);
  console.log("status:", receipt.status);
  return { hash, receipt };
}

