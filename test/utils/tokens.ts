import Decimal from 'decimal.js';
import { BigNumber } from 'ethers';
import { ethers } from 'hardhat';

import { TestToken } from '../../typechain-types';

import { getOwnerAccount } from './accounts';

const DeployedTokens = new Map<number, TestToken>();

const deployTokenWithDecimals = async (decimals: number) => {
  let token = DeployedTokens.get(decimals);

  if (!token) {
    const ownerAccount = await getOwnerAccount();

    const TestTokenContract = await ethers.getContractFactory(
      'TestToken',
      ownerAccount
    );

    token = await TestTokenContract.deploy(decimals);

    await token.deployTransaction.wait();

    DeployedTokens.set(decimals, token);
  }

  return token;
};

const resetDeployedTokens = () => {
  DeployedTokens.clear();
};

const getDecimalsByDeployedToken = (token: TestToken) => {
  for (const [decimals, deployedToken] of DeployedTokens) {
    if (Object.is(token, deployedToken)) {
      return decimals;
    }
  }
  throw new Error('Unable to get decimals for token');
};

const normalizeAmountForToken = (
  amount: Decimal | BigNumber | number,
  token: TestToken
) => {
  const decimalFactor = Decimal.pow(10, getDecimalsByDeployedToken(token));

  return new Decimal(
    amount instanceof BigNumber ? amount.toString() : amount
  ).times(decimalFactor);
};

const denormalizeAmountForToken = (
  amount: Decimal | BigNumber | number,
  token: TestToken
) => {
  const decimalFactor = Decimal.pow(10, getDecimalsByDeployedToken(token));

  return new Decimal(
    amount instanceof BigNumber ? amount.toString() : amount
  ).div(decimalFactor);
};

const dton = normalizeAmountForToken;
const ntod = denormalizeAmountForToken;

export {
  deployTokenWithDecimals,
  resetDeployedTokens,
  normalizeAmountForToken,
  denormalizeAmountForToken,
  dton,
  ntod
};
