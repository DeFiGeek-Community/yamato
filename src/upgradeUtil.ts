import { ethers, upgrades, artifacts } from "hardhat";
import { BaseContract, ContractFactory, BigNumber, BigNumberish } from "ethers";
import { getLinkedContractFactory, deployLibrary } from "./testUtil";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "fs";
import { getDeploymentAddressPathWithTag, setNetwork } from "./deployUtil";
import { execSync } from "child_process";
import { PriorityRegistry, PriorityRegistryV4 } from "../typechain";

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

export async function runUpgrade(implNameBase, linkings = []) {
  setNetwork("rinkeby");

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
    console.log(`${implName} is going to be deployed to ERC1967Proxy...`);

    const inst =
      linkings.length > 0
        ? await upgradeLinkedProxy(ERC1967Proxy, implName, linkings)
        : await upgradeProxy(ERC1967Proxy, implName);
    console.log(`${inst.address} is upgraded to ${implName}`);

    const implAddr = await (<any>inst).getImplementation();
    const implPath = getDeploymentAddressPathWithTag(implNameBase, "UUPSImpl");

    writeFileSync(implPath, implAddr);
    console.log(`Saved ${implAddr} to ${implPath}`);

    try {
      execSync(
        `npm run verify:rinkeby -- --contract contracts/${implName}.sol:${implName} ${implAddr}`
      );
      console.log(`Verified ${implAddr}`);
    } catch (e) {
      console.error(e.message);
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

export async function upgradePriorityRegistryV2ToV4AndSync(
  PriorityRegistry: PriorityRegistry,
  pledges: {
    coll: BigNumberish;
    debt: BigNumberish;
    isCreated: boolean;
    owner: string;
    priority: BigNumberish;
  }[]
): Promise<PriorityRegistryV4> {
  const inst: PriorityRegistryV4 = <PriorityRegistryV4>(
    await upgradeLinkedProxy(PriorityRegistry.address, "PriorityRegistryV4", [
      "PledgeLib",
    ])
  );
  await inst.syncRankedQueue(pledges);
  return inst;
}
