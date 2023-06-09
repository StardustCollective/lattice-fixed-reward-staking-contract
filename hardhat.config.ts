import * as dotenv from 'dotenv';
import { HardhatUserConfig } from 'hardhat/config';
import '@nomicfoundation/hardhat-toolbox';
import { NetworkUserConfig } from 'hardhat/types';

import { initializeDayJs } from './exlib/dayjs';

dotenv.config();

initializeDayJs();

const accounts = process.env.LATTICE_EXCHANGE_ACCOUNT_PK
  ? [process.env.LATTICE_EXCHANGE_ACCOUNT_PK]
  : [];

const getNetworkConfig = (alias: string, url: string | undefined) => {
  const network: Record<string, NetworkUserConfig> = {};

  if (url) {
    network[alias] = { url, accounts };
  }

  return network;
};

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
    ...getNetworkConfig('ethereum', process.env.QUICKNODE_ETHEREUM_MAINNET),
    ...getNetworkConfig('goerli', process.env.QUICKNODE_ETHEREUM_GOERLI),
    ...getNetworkConfig('polygon', process.env.QUICKNODE_POLYGON_MAINNET),
    ...getNetworkConfig('mumbai', process.env.QUICKNODE_POLYGON_MUMBAI)
  }
};

export default config;
