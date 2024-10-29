import { readFileSync, writeFileSync, existsSync } from "fs";

function _getDeploymentAddressPathWithTag(
  contractName: string,
  tag: string,
  additionalDir?: string
): string {
  return additionalDir
    ? `./deployments/${process.env.NETWORK}/${additionalDir}/${contractName}${tag}`
    : `./deployments/${process.env.NETWORK}/${contractName}${tag}`;
}

export function getDeploymentAddressPath(
  contractName: string,
  additionalDir?: string
): string {
  return _getDeploymentAddressPathWithTag(contractName, "", additionalDir);
}

export function getDeploymentAddressPathWithTag(
  contractName: string,
  tag: string,
  additionalDir?: string
): string {
  return _getDeploymentAddressPathWithTag(contractName, tag, additionalDir);
}

// アドレスをファイルに書き込む関数
export function writeDeploymentAddress(
  contractName: string,
  tag: string = "",
  address: string,
  additionalDir?: string
): void {
  const filePath = _getDeploymentAddressPathWithTag(
    contractName,
    tag,
    additionalDir
  );
  writeFileSync(filePath, address);
  console.log(`Address for ${contractName}${tag} written to ${filePath}`);
}

// ファイルからアドレスを読み出す関数
export function readDeploymentAddress(
  contractName: string,
  tag: string = "",
  additionalDir?: string
): string {
  const filePath = _getDeploymentAddressPathWithTag(
    contractName,
    tag,
    additionalDir
  );
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
