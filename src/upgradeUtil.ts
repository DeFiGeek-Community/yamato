import { ethers, upgrades, artifacts } from "hardhat";
import { BaseContract, ContractFactory, BigNumber } from "ethers";
import { getLinkedContractFactory, deployLibrary } from "./testUtil";

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
