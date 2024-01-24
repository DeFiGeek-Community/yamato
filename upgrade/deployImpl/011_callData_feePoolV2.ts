import { ethers, Contract } from "ethers";
import { writeFileSync, readFileSync } from "fs";
import { getDeploymentAddressPath, setNetwork, setProvider } from "../../src/deployUtil";
import { genABI } from "../../src/genABI";

(async () => {
  setNetwork(process.env.NETWORK);
  const p = await setProvider();
  const ymtAddr = readFileSync(getDeploymentAddressPath("YMT")).toString();

  const YMT = new Contract(ymtAddr, genABI("YMT"), p);
  const number = await YMT.startTime();
  console.log(Number(number));

  const bytes32Number = ethers.utils.solidityPack(["uint256"], [Number(number)]);

  const selector = 0x5b4e128c;
  const packedBytes = ethers.utils.solidityPack(
    ["bytes", "uint256"],
    [selector, bytes32Number]
  );

  console.log(packedBytes);
  setNetwork(process.env.NETWORK);
  const implPath = getDeploymentAddressPath("FeePoolV2CallData");
  writeFileSync(implPath, packedBytes);
})();