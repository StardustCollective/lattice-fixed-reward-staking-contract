import { ethers } from 'hardhat';

const NamedAccounts = [
  'owner',
  'steward-role',
  'configuration-role',
  'user-a',
  'user-b',
  'user-c'
] as const;

type NamedAccount = (typeof NamedAccounts)[number];

const getOwnerAccount = async () => {
  return getNamedAccount('owner');
};

const getNamedAccount = async (account: NamedAccount) => {
  const accounts = await ethers.getSigners();
  const index = NamedAccounts.findIndex(
    (namedAccount) => namedAccount === account
  );

  if (index === -1) {
    throw new Error('Unable to find named account => ' + account);
  }

  return accounts[index];
};

export { NamedAccounts, NamedAccount, getOwnerAccount, getNamedAccount };
