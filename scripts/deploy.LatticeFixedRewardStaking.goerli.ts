import hre, { ethers } from 'hardhat';

import { generateSolidityStdInputForContract } from '../utils';

async function main() {
  if (hre.network.name !== 'goerli') {
    throw new Error('Bad network config, must be goerli');
  }

  await generateSolidityStdInputForContract('LatticeFixedRewardStaking');

  const StakingContract = await ethers.getContractFactory(
    'LatticeFixedRewardStaking'
  );
  const staking = await StakingContract.deploy();

  await staking.deployed();

  console.log(
    `LatticeFixedRewardStaking deployed at address ${staking.address} by ${staking.deployTransaction.from}`
  );
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
