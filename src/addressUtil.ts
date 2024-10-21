import { readFileSync, writeFileSync, existsSync } from "fs";

function _getDeploymentAddressPathWithTag(
  contractName: string,
  tag: string
): string {
  return `./deployments/${process.env.NETWORK}/${contractName}${tag}`;
}

export function getDeploymentAddressPath(contractName: string): string {
  return _getDeploymentAddressPathWithTag(contractName, "");
}

export function getDeploymentAddressPathWithTag(
  contractName: string,
  tag: string
): string {
  return _getDeploymentAddressPathWithTag(contractName, tag);
}

// アドレスをファイルに書き込む関数
export function writeDeploymentAddress(
  contractName: string,
  tag: string = "",
  address: string
): void {
  const filePath = _getDeploymentAddressPathWithTag(contractName, tag);
  writeFileSync(filePath, address);
  console.log(`Address for ${contractName}${tag} written to ${filePath}`);
}

// ファイルからアドレスを読み出す関数
export function readDeploymentAddress(
  contractName: string,
  tag: string = ""
): string {
  const filePath = _getDeploymentAddressPathWithTag(contractName, tag);
  if (existsSync(filePath)) {
    const savedAddress = readFileSync(filePath, { encoding: "utf8" });
    console.log(
      `Address for ${contractName}${tag} read from ${filePath}: ${savedAddress}`
    );
    return savedAddress;
  } else {
    console.log(`Address file for ${contractName}${tag} does not exist.`);
    return "";
  }
}
