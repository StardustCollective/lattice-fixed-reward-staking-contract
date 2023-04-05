import { ethers } from 'hardhat';

import { User } from '../types';

const getOwnerAccount = async () => {
  return (await ethers.getSigners())[0];
};

const getUserAccount = async (name: User) => {
  return (await ethers.getSigners())[
    name.toLocaleUpperCase().charCodeAt(0) - 64
  ];
};

export { getOwnerAccount, getUserAccount };
