import { ethers } from "hardhat";
import { BaseContract,BigNumber } from "ethers";
import { FakeContract, smock } from "@defi-wonderland/smock";


// @dev UUPS 
export async function getFakeProxy<T extends BaseContract>(contractName: string): Promise<FakeContract<T>> {
    let mock = await smock.fake<T>(contractName)
    const proxy = await (await ethers.getContractFactory("ERC1967Proxy")).deploy(mock.address, BigNumber.from(0)) // from @openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol
    mock.attach(proxy.address)
    return mock;
}

