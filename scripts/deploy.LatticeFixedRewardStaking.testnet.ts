import dayjs from 'dayjs';
import Decimal from 'decimal.js';
import hre, { ethers } from 'hardhat';

import { waitForTransaction } from '../test/utils';
import { generateSolidityStdInputForContract } from '../utils';

const TT18_CONTRACT_ADDRESS: Record<string, string> = {
  goerli: '0xf838173d1bb7cda2de602c6974cd8af010566ed3',
  mumbai: '0x74299a718b2c44483a27325d7725f0b2646de3b1'
};

async function main() {
  if (!['goerli', 'mumbai'].includes(hre.network.name)) {
    throw new Error('Bad network config, must be a testnet');
  }

  const signer = (await ethers.getSigners())[0];

  const testToken18 = await ethers.getContractAt(
    'TestToken',
    TT18_CONTRACT_ADDRESS[hre.network.name],
    signer
  );
  const testToken18Decimals = await testToken18.decimals();

  await generateSolidityStdInputForContract('LatticeFixedRewardStaking');

  const StakingContract = await ethers.getContractFactory(
    'LatticeFixedRewardStaking'
  );

  const staking = await StakingContract.deploy(
    TT18_CONTRACT_ADDRESS[hre.network.name],
    new Decimal(100).times(Decimal.pow(10, testToken18Decimals)).toFixed(),
    TT18_CONTRACT_ADDRESS[hre.network.name],
    new Decimal(100).times(Decimal.pow(10, testToken18Decimals)).toFixed(),
    dayjs().startOf('hour').unix(),
    dayjs().startOf('hour').add(1, 'day').unix(),
    '1',
    '100',
    []
  );

  await staking.deployed();

  console.log(
    `LatticeFixedRewardStaking deployed at address ${staking.address} by ${staking.deployTransaction.from}`
  );

  await waitForTransaction(
    testToken18.mint(
      signer.address,
      new Decimal(10000).times(Decimal.pow(10, testToken18Decimals)).toFixed()
    )
  );
  console.log(`Minted 10000 TT18 tokens to signer ${signer.address}`);

  await waitForTransaction(
    testToken18.approve(
      staking.address,
      new Decimal(10000).times(Decimal.pow(10, testToken18Decimals)).toFixed()
    )
  );
  console.log(
    `Approved 10000 TT18 tokens for consumption by ${staking.address}`
  );

  await waitForTransaction(
    staking.depositProgramRewards(
      new Decimal(10000).times(Decimal.pow(10, testToken18Decimals)).toFixed()
    )
  );
  console.log(`Transfered 10000 TT18 reward tokens in ${staking.address}`);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
