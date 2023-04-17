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
      url: `https://mainnet.infura.io/v3/${process.env.INFURA_PROJECT_ID}`,
      accounts
    },
    goerli: {
      url: `https://goerli.infura.io/v3/${process.env.INFURA_PROJECT_ID}`,
      accounts
    }
  }
};

export default config;
