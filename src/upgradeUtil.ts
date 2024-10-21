import { ethers, upgrades, artifacts, defender } from "hardhat";
import { ExtendedProposalResponse } from "@openzeppelin/hardhat-defender/dist/propose-upgrade";
import { BaseContract, ContractFactory, BigNumber, BigNumberish } from "ethers";
import { getLinkedContractFactory, deployLibrary } from "./testUtil";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "fs";
import { getDeploymentAddressPathWithTag, setNetwork } from "./deployUtil";
import { execSync } from "child_process";
import { PriorityRegistry, PriorityRegistryV5 } from "../typechain";
import chalk from "chalk";
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
    return "";
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
  contractABI: any,
  methodName: string,
  args: any[] = []
) {
  // .envからDEPLOYER_PRIVATE_KEYを読み込む
  const deployerPrivateKey = process.env.DEPLOYER_PRIVATE_KEY;
  if (!deployerPrivateKey) {
    console.error("DEPLOYER_PRIVATE_KEY is not defined in .env file");
    return;
  }

  // JsonRpcProviderと秘密鍵からWalletを生成し、サイナーとして使用
  const provider = new ethers.providers.JsonRpcProvider();
  const signer = new ethers.Wallet(deployerPrivateKey, provider);

  const contract = new ethers.Contract(contractAddress, contractABI, signer);

  const transactionResponse = await contract[methodName](...args);
  await transactionResponse.wait(); // トランザクションの確定を待つ

  console.log(
    `Executing method: ${methodName} on contract: ${contractAddress} with arguments:`,
    args
  );
}
