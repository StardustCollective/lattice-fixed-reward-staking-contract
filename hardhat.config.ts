import { HardhatUserConfig } from 'hardhat/config';

import '@nomicfoundation/hardhat-toolbox';
import { initializeDayJs } from './exlib/dayjs';

initializeDayJs();

const config: HardhatUserConfig = {
  solidity: '0.8.18'
};

export default config;
