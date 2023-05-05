import * as dotenv from 'dotenv';
import { HardhatUserConfig } from 'hardhat/config';

import '@nomicfoundation/hardhat-toolbox';
import { initializeDayJs } from './exlib/dayjs';

dotenv.config();

initializeDayJs();

const accounts = process.env.LATTICE_EXCHANGE_ACCOUNT_PK
  ? [process.env.LATTICE_EXCHANGE_ACCOUNT_PK]
  : [];

const config: HardhatUserConfig = {
  solidity: '0.8.18',
  networks: {
    hardhat: {
      accounts: {
        mnemonic: 'test test test test test test test test test test test junk',
        initialIndex: 0,
        count: 100
      }
    },
    mainnet: {
      url: process.env.QUICKNODE_ETHEREUM_MAINNET,
      accounts
    },
    goerli: {
      url: process.env.QUICKNODE_ETHEREUM_GOERLI,
      accounts
    },
    polygon: {
      url: process.env.QUICKNODE_POLYGON_MAINNET,
      accounts
    },
    mumbai: {
      url: process.env.QUICKNODE_POLYGON_MUMBAI,
      accounts
    }
  }
};

export default config;
