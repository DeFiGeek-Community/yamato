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
>(olderInstanceAddress: string, contractNameTo: string): Promise<T> {
  let contractFactory: S = <S>await ethers.getContractFactory(contractNameTo);
  const instance: T = <T>await upgrades.upgradeProxy(
    olderInstanceAddress,
    contractFactory,
    {
      kind: "uups",
    }
  );
  return instance;
}

export async function upgradeLinkedProxy<
  T extends BaseContract,
  S extends ContractFactory
>(
  olderInstanceAddress: string,
  contractNameTo: string,
  libralies: string[]
): Promise<T> {
  let Libraries = {};
  for (var i = 0; i < libralies.length; i++) {
    let libraryName = libralies[i];
    Libraries[libraryName] = (await deployLibrary(libraryName)).address;
  }
  // Note: Libraries upgrade requires you to re-deploy the whole library. That's expensive.

  let contractFactory: S = <S>(
    await getLinkedContractFactory(contractNameTo, Libraries)
  );
  const newerInstance: T = <T>await upgrades.upgradeProxy(
    olderInstanceAddress,
    contractFactory,
    {
      kind: "uups",
      unsafeAllow: ["external-library-linking"],
    }
  );
  return newerInstance;
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
  multisigAddr: string
): Promise<ExtendedProposalResponse> {
  let contractFactory: S = <S>await ethers.getContractFactory(contractNameTo);
  const res: ExtendedProposalResponse = await defender.proposeUpgrade(
    olderInstanceAddress,
    contractFactory,
    { multisig: multisigAddr, proxyAdmin: multisigAddr }
  );
  return res;
}
export async function proposeUpgradeLinkedProxy<
  T extends BaseContract,
  S extends ContractFactory
>(
  olderInstanceAddress: string,
  contractNameTo: string,
  libralies: string[]
): Promise<ExtendedProposalResponse> {
  let Libraries = {};
  for (var i = 0; i < libralies.length; i++) {
    let libraryName = libralies[i];
    Libraries[libraryName] = (await deployLibrary(libraryName)).address;
  }
  // Note: Libraries upgrade requires you to re-deploy the whole library. That's expensive.

  let contractFactory: S = <S>(
    await getLinkedContractFactory(contractNameTo, Libraries)
  );
  const res: ExtendedProposalResponse = await defender.proposeUpgrade(
    olderInstanceAddress,
    contractFactory,
    {
      unsafeAllow: ["external-library-linking"],
    }
  );
  return res;
}

export async function runDowngrade(
  implNameBase: string,
  versionStr: string,
  linkings = []
) {
  setNetwork("goerli");
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

    const inst =
      linkings.length > 0
        ? await upgradeLinkedProxy(ERC1967Proxy, implName, linkings)
        : await upgradeProxy(ERC1967Proxy, implName);
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
      execSync(
        `npm run verify:goerli -- --contract contracts/${implName}.sol:${implName} ${implAddr}`
      );
      console.log(`Verified ${implAddr}`);
    } catch (e) {
      console.error(e.message);
    }
  }
}
export async function runUpgrade(implNameBase, linkings = []) {
  setNetwork("goerli");

  const filepath = getDeploymentAddressPathWithTag(
    implNameBase,
    "ERC1967Proxy"
  );
  if (!existsSync(filepath)) throw new Error(`${filepath} is not exist`);
  const ERC1967Proxy: string = readFileSync(filepath).toString();

  const implName = getLatestContractName(implNameBase);
  if (implName.length == 0) {
    console.log(
      `./contracts/${implNameBase} only found. Set ./contracts/${implNameBase}V2 to start upgrading.`
    );
  } else {
    // console.log(`${implName} is going to be deployed to ERC1967Proxy...`);
    let multisigAddr = process.env.UUPS_PROXY_ADMIN_MULTISIG_ADDRESS;
    if (!multisigAddr) {
      const inst =
        linkings.length > 0
          ? await upgradeLinkedProxy(ERC1967Proxy, implName, linkings)
          : await upgradeProxy(ERC1967Proxy, implName);
      console.log(
        chalk.gray(
          `        [success] ${implName}=${inst.address} is upgraded to ERC1967Proxy`
        )
      );

      const implAddr = await (<any>inst).getImplementation();

      try {
        execSync(
          `npm run verify:goerli -- --contract contracts/${implName}.sol:${implName} ${implAddr}`
        );
        console.log(`Verified ${implAddr}`);
      } catch (e) {
        console.error(e.message);
      }

      const implPath = getDeploymentAddressPathWithTag(
        implNameBase,
        "UUPSImpl"
      );
      writeFileSync(implPath, implAddr);
    } else {
      const res =
        linkings.length > 0
          ? await proposeUpgradeLinkedProxy(ERC1967Proxy, implName, linkings)
          : await proposeUpgradeProxy(ERC1967Proxy, implName, multisigAddr);

      console.log(res.verificationResponse);

      // const implPath = getDeploymentAddressPathWithTag(implNameBase, "UUPSImpl");
      // writeFileSync(implPath, implAddr);
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
  if (versions.length == 0) {
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
    await upgradeLinkedProxy(PriorityRegistry.address, "PriorityRegistryV5", [
      "PledgeLib",
    ])
  );
  await inst.syncRankedQueue(pledges);
  return inst;
}
