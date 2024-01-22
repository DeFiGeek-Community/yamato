import { ethers } from "ethers";
import { writeFileSync } from "fs";
import { getDeploymentAddressPath, setNetwork } from "../../src/deployUtil";

// 実際利用するtimestampを入れる
const number = 1705895822;

const bytes32Number = ethers.utils.solidityPack(["uint256"], [number]);

const selector = 0x5b4e128c;
const packedBytes = ethers.utils.solidityPack(
  ["bytes", "uint256"],
  [selector, bytes32Number]
);

console.log(packedBytes);
setNetwork(process.env.NETWORK);
const implPath = getDeploymentAddressPath("FeePoolV2CallData");
writeFileSync(implPath, packedBytes);
