import { ethers, upgrades, artifacts } from "hardhat";
import { BaseContract, ContractFactory, BigNumber } from "ethers";
import { FakeContract, smock } from "@defi-wonderland/smock";

// @dev UUPS
export async function getFakeProxy<T extends BaseContract>(
  contractName: string
): Promise<FakeContract<T>> {
  let mock = await smock.fake<T>(contractName);
  if (typeof mock.upgradeTo !== "function")
    throw new Error(
      `${contractName} has to inherit UUPSUpgradeable to have upgradeTo().`
    );
  const proxy = await (
    await ethers.getContractFactory("ERC1967Proxy")
  ).deploy(mock.address, BigNumber.from(0)); // from @openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol
  mock.attach(proxy.address);
  return mock;
}

export async function getProxy<
  T extends BaseContract,
  S extends ContractFactory
>(contractName: string, args: any): Promise<T> {
  let contractFactory: S = <S>await ethers.getContractFactory(contractName);
  const instance: T = <T>(
    await upgrades.deployProxy(contractFactory, args, { kind: "uups" })
  );
  return instance;
}

export async function getLinkedProxy<
  T extends BaseContract,
  S extends ContractFactory
>(contractName: string, args: Array<any>, libralies: string[]): Promise<T> {
  let Libraries = {};
  for (var i = 0; i < libralies.length; i++) {
    let libraryName = libralies[i];
    Libraries[libraryName] = (await deployLibrary(libraryName)).address;
  }

  let contractFactory: S = <S>(
    await getLinkedContractFactory(contractName, Libraries)
  );
  const instance: T = <T>(
    await upgrades.deployProxy(contractFactory, args, {
      kind: "uups",
      unsafeAllow: ["external-library-linking"],
    })
  );
  return instance;
}

async function deployLibrary(libraryName) {
  const Library = await ethers.getContractFactory(libraryName);
  const library = await Library.deploy();
  await library.deployed();
  return library;
}

async function getLinkedContractFactory(contractName, libraries) {
  const cArtifact = await artifacts.readArtifact(contractName);
  const linkedBytecode = linkBytecode(cArtifact, libraries);
  const ContractFactory = await ethers.getContractFactory(
    cArtifact.abi,
    linkedBytecode
  );
  return ContractFactory;
}

// linkBytecode: performs linking by replacing placeholders with deployed addresses
// Recommended workaround from Hardhat team until linking feature is implemented
// https://github.com/nomiclabs/hardhat/issues/611#issuecomment-638891597
function linkBytecode(artifact, libraries) {
  let bytecode = artifact.bytecode;
  for (const [, fileReferences] of Object.entries(artifact.linkReferences)) {
    for (const [libName, fixups] of Object.entries(fileReferences)) {
      const addr = libraries[libName];
      if (addr === undefined) {
        continue;
      }
      for (const fixup of fixups) {
        bytecode =
          bytecode.substr(0, 2 + fixup.start * 2) +
          addr.substr(2) +
          bytecode.substr(2 + (fixup.start + fixup.length) * 2);
      }
    }
  }
  return bytecode;
}
