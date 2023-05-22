require("dotenv").config();

// import 'tsconfig-paths/register';
/* 
This module is related to the feature, path mapping, for TypeScript(in this case ts-node).
Path mapping causes lots of annoying and we should stop using this.
*/
import "@nomiclabs/hardhat-ethers";
import "@nomiclabs/hardhat-waffle";
import "@nomiclabs/hardhat-web3";
import "hardhat-tracer";
import "@nomiclabs/hardhat-solhint";
import "hardhat-deploy";
import "hardhat-deploy-ethers";
import "@typechain/hardhat";
import "@nomiclabs/hardhat-etherscan";
import "hardhat-abi-exporter";
import "hardhat-contract-sizer";
import "hardhat-gas-reporter";
import "@openzeppelin/hardhat-upgrades";
import "@openzeppelin/hardhat-defender";

// TODO
// make a defender multisig on goerli  0x585876db533ab88A66847891054f2bf78BCcabcA
// deploy contracts to goerli
// get API keys of infura, etherscan, and archemy
// set it to hardhat.config.ts
// transfer ownership to multisig wallet (How can we do acceptOwnership?)
// set that address to .env to tell upgrade sript to use defender or not
// propose upgrade
// see verification result

if (!process.env.ALCHEMY_URL) throw Error("Get your .env");

/**
 * @type import('hardhat/config').HardhatUserConfig
 */
module.exports = {
  solidity: {
    compilers: [
      {
        version: "0.8.4",
        settings: {
          outputSelection: {
            "*": {
              "*": ["storageLayout"],
            },
          },
          optimizer: {
            enabled: true,
            runs: 1000,
          },
        },
      },
    ],
  },
  networks: {
    hardhat: {
      allowUnlimitedContractSize: true,
      accounts: {
        count: 200,
        accountsBalance: "1000000000000000000000000",
      },
    },
    goerli: {
      url: process.env.ALCHEMY_URL,
      accounts: [
        process.env.FOUNDATION_PRIVATE_KEY,
        process.env.DEPLOYER_PRIVATE_KEY,
      ],
      live: true,
      saveDeployments: true,
      tags: ["staging"],
    },
    kovan: {
      url: process.env.ALCHEMY_URL.replace(/goerli/, "kovan"),
      accounts: [
        process.env.FOUNDATION_PRIVATE_KEY,
        process.env.DEPLOYER_PRIVATE_KEY,
      ],
      live: true,
      saveDeployments: true,
      tags: ["staging"],
    },
  },
  ovm: {
    solcVersion: "0.7.6",
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY,
  },
  namedAccounts: {
    foundation: {
      default: 1,
      mainnet: "0xdAe503Fd260358b8f344D136160c299530006170",
      goerli: "0xdAe503Fd260358b8f344D136160c299530006170",
    },
    deployer: {
      default: 2,
      mainnet: "0xD2dd063B77cdB7b2823297a305195128eF2C300c",
      goerli: "0xD2dd063B77cdB7b2823297a305195128eF2C300c",
    },
  },
  abiExporter: {
    path: "./abis/yamato-abis",
    clear: true,
    flat: true,
    except: ["Dependencies", "Interfaces", "mock"],
    spacing: 2,
  },
  mocha: {
    timeout: 1200000,
    forbidOnly: process.env.NODE_ENV === "ci",
  },
  contractSizer: {
    alphaSort: true,
    disambiguatePaths: false,
    runOnCompile: true,
    strict: false,
  },
  gasReporter: {
    currency: "USD",
    gasPrice: 100,
  },
  defender: {
    apiKey: process.env.DEFENDER_TEAM_API_KEY,
    apiSecret: process.env.DEFENDER_TEAM_API_SECRET_KEY,
  }
};
