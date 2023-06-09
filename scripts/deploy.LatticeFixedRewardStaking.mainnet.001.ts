import dayjs from 'dayjs';
import hre, { ethers } from 'hardhat';

import { generateSolidityStdInputForContract } from '../utils';

const STAKING_TOKEN_ADDRESS = '0x6758647a4Cd6b4225b922b456Be5C05359012032';
const REWARD_TOKEN_ADDRESS = '0x6758647a4Cd6b4225b922b456Be5C05359012032';
const STEWARDS_ADDRESSES = [
  '0x5A1d6F6051DFB04962bDB78B3AC01F3a6D817aF6',
  '0x04891a6b907a53e01797404D9af0e605AD260efb',
  '0x6d64004A60edA219690014Acf783F833f4F868f6'
];
const PROGRAM_STARTS_AT_ISO = '2023-06-07T17:00:00.000Z';
const PROGRAM_ENDS_AT_ISO = '2023-09-07T17:00:00.000Z';
const TAX_RATIO_NUM = 5;
const TAX_RATIO_DEN = 100;

async function main() {
  if (!['ethereum'].includes(hre.network.name)) {
    throw new Error('Bad network config, must be a mainnet');
  }

  const signer = (await ethers.getSigners())[0];

  await generateSolidityStdInputForContract('LatticeFixedRewardStaking');

  const StakingContract = await ethers.getContractFactory(
    'LatticeFixedRewardStaking'
  );

  if (!ethers.utils.isAddress(STAKING_TOKEN_ADDRESS)) {
    throw new Error('Invalid staking token address');
  }

  if (!ethers.utils.isAddress(REWARD_TOKEN_ADDRESS)) {
    throw new Error('Invalid reward token address');
  }

  if (!STEWARDS_ADDRESSES.every(ethers.utils.isAddress)) {
    throw new Error('Invalid steward roles addresses');
  }

  const trxRequest = StakingContract.getDeployTransaction(
    STAKING_TOKEN_ADDRESS,
    0,
    REWARD_TOKEN_ADDRESS,
    0,
    dayjs(PROGRAM_STARTS_AT_ISO).unix(),
    dayjs(PROGRAM_ENDS_AT_ISO).unix(),
    TAX_RATIO_NUM,
    TAX_RATIO_DEN,
    STEWARDS_ADDRESSES
  );

  const estimatedGas = await signer.estimateGas(trxRequest);
  const gasPrice = await signer.getGasPrice();
  const totalEstimatedCost = estimatedGas.mul(gasPrice);

  console.log(
    JSON.stringify(
      {
        estimatedGas: estimatedGas.toString(),
        gasPrice: gasPrice.toString(),
        totalEstimatedCost: totalEstimatedCost.toString(),

        gasPriceGwei: ethers.utils.formatUnits(gasPrice, 'gwei'),
        totalEstimatedCostEth: ethers.utils.formatUnits(
          totalEstimatedCost,
          'ether'
        )
      },
      null,
      2
    )
  );

  return;

  console.log('Sending transaction');

  const trx = await signer.sendTransaction(trxRequest);

  console.log('Waiting confirmation');

  const trxReceipt = await trx.wait(2);

  console.log(
    `LatticeFixedRewardStaking deployed at address ${trxReceipt.contractAddress} by ${trxReceipt.from}`
  );
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
