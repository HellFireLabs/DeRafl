import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "hardhat-gas-reporter"
import {config as env} from  "dotenv"
import "solidity-docgen"
import "@nomiclabs/hardhat-etherscan";

const {
  GOERLI_RPC_URL,
  ETH_MAINNET_URL,
  PRIVATE_KEY,
  ETHERSCAN_API_KEY,
  TEST_DEPLOYER_PRIVATE_KEY
}: any = env().parsed;

const config: HardhatUserConfig = {
  solidity: "0.8.18",
  networks: {
    hardhat: {
      chainId: 1337,
      forking: {
        url: GOERLI_RPC_URL || '',
        blockNumber: 8610251
      }
    },
    mainnet: {
      url: ETH_MAINNET_URL || '',
      accounts: [TEST_DEPLOYER_PRIVATE_KEY!]
    },
    goerli: {
      url: GOERLI_RPC_URL,
      accounts: [PRIVATE_KEY]
    }
  },
  gasReporter: {
    enabled: true,
    currency: 'ETH',
    gasPrice: 200
  },
  docgen: {
    exclude: ['interface', 'mock', 'test']
  },
  etherscan: {
    apiKey: ETHERSCAN_API_KEY
  }
};

export default config;
