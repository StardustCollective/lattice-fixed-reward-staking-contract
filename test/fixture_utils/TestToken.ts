import Decimal from 'decimal.js';
import { Contract } from 'ethers';
import { ethers } from 'hardhat';

import { getOwnerAccount, waitForTransaction } from '../utils';

import { createFixtureUtil } from './meta';

const deployContract = createFixtureUtil(
  () => ({ tokenDecimals: 18 }),
  async (params) => {
    const contractFactory = await ethers.getContractFactory('TestToken');

    const contract = await contractFactory.deploy(params.tokenDecimals);

    await contract.deployed();

    return contract;
  }
);

const mintTokens = createFixtureUtil(
  () => ({
    contract: deployContract(),
    account: getOwnerAccount(),
    caller: getOwnerAccount(),
    amount: new Decimal(100)
  }),
  async (params) => {
    const decimals = await params.contract.decimals();

    const trx = await params.contract
      .connect(params.caller)
      .mint(
        params.account.address,
        params.amount.times(Decimal.pow(10, decimals)).toFixed()
      );

    await waitForTransaction(trx);
  }
);

const approveTokens = createFixtureUtil(
  () => ({
    contract: deployContract(),
    spender: deployContract() as Promise<Contract> | Contract,
    caller: getOwnerAccount(),
    amount: new Decimal(100)
  }),
  async (params) => {
    const decimals = await params.contract.decimals();

    const trx = await params.contract
      .connect(params.caller)
      .approve(
        params.spender.address,
        params.amount.times(Decimal.pow(10, decimals)).toFixed()
      );

    await waitForTransaction(trx);
  }
);

const mintAndApproveTokens = createFixtureUtil(
  () => ({
    contract: deployContract(),
    receiver: getOwnerAccount(),
    spender: deployContract() as Promise<Contract> | Contract,
    minter: getOwnerAccount(),
    amount: new Decimal(100)
  }),
  async (params) => {
    const decimals = await params.contract.decimals();

    await waitForTransaction(
      params.contract
        .connect(params.minter)
        .mint(
          params.receiver.address,
          params.amount.times(Decimal.pow(10, decimals)).toFixed()
        )
    );

    await waitForTransaction(
      params.contract
        .connect(params.receiver)
        .approve(
          params.spender.address,
          params.amount.times(Decimal.pow(10, decimals)).toFixed()
        )
    );
  }
);

const TestTokenFixtureUtils = {
  deployContract,
  mintTokens,
  approveTokens,
  mintAndApproveTokens
};

export { TestTokenFixtureUtils };
