import { readFileSync } from "fs";
import { utils } from "ethers";

export function genABI(filename, isDependency = false) {
  return new utils.Interface(
    JSON.parse(
      readFileSync(
        `artifacts/contracts/${
          isDependency ? "Dependencies/" : "/"
        }${filename}.sol/${filename}.json`
      ).toString()
    ).abi
  );
}
