require("dotenv").config();

import "tsconfig-paths/register";

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

if (!process.env.ALCHEMY_URL) throw Error("Get your .env");

/**
 * @type import('hardhat/config').HardhatUserConfig
 */
module.exports = {
  solidity: {
    compilers: [
      {
        version: "0.7.6",
        settings: {
          outputSelection: {
            "*": {
              "*": ["storageLayout"],
            },
          },
        },
      },

      {
        version: "0.8.3",
        settings: {
          outputSelection: {
            "*": {
              "*": ["storageLayout"],
            },
          },
        },
      },
      {
        version: "0.8.4",
        settings: {
          outputSelection: {
            "*": {
              "*": ["storageLayout"],
            },
          },
        },
      },
    ],
  },
  networks: {
    hardhat: {},
    rinkeby: {
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
      url: process.env.ALCHEMY_URL.replace(/rinkeby/, "kovan"),
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
      rinkeby: "0xdAe503Fd260358b8f344D136160c299530006170",
    },
    deployer: {
      default: 2,
      mainnet: "0xD2dd063B77cdB7b2823297a305195128eF2C300c",
      rinkeby: "0xD2dd063B77cdB7b2823297a305195128eF2C300c",
    },
  },
  abiExporter: {
    path: "./abis/yamato-abis",
    clear: true,
    flat: true,
    except: ["Dependencies", "Interfaces", "mock"],
    spacing: 2,
  },
};
