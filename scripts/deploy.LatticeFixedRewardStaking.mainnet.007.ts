import dayjs from 'dayjs';
import hre, { ethers } from 'hardhat';

import { generateSolidityStdInputForContract } from '../utils';

/**
 * ECET / ECET
 */

const STAKING_TOKEN_ADDRESS = '0xC1ab7e48FaFEE6b2596c65261392E59690cE7742';
const REWARD_TOKEN_ADDRESS = '0xC1ab7e48FaFEE6b2596c65261392E59690cE7742';
const STEWARDS_ADDRESSES = ['0x11f939df0eFe089200D661d4722625c6b9B42A2a'];
const PROGRAM_STARTS_AT_ISO = '2024-07-17T20:00:00.000Z';
const PROGRAM_ENDS_AT_ISO = '2025-07-17T20:00:00.000Z';
const TAX_RATIO_NUM = 5;
const TAX_RATIO_DEN = 100;

async function main() {
  if (!['polygon'].includes(hre.network.name)) {
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
