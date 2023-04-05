import dayjs from 'dayjs';
import Decimal from 'decimal.js';
import lodash from 'lodash';
import { ethers } from 'hardhat';

import { StakingContractConfiguration } from '../types';
import { LatticeLpStaking } from '../../typechain-types';

import { deployTokenWithDecimals, dton } from './tokens';
import { getOwnerAccount } from './accounts';
import { waitForTransaction } from './transactions';

const DefaultStakingContractConfiguration: StakingContractConfiguration = {
  stakingTokenDecimals: 18,
  minStakingAmount: new Decimal('100'),
  rewardTokenDecimals: 8,
  minRewardAmount: new Decimal('10'),
  programRewardAmount: new Decimal('30000'),
  programStartsAt: dayjs().startOf('day').add(3, 'days'),
  programEndsAt: dayjs().startOf('day').add(33, 'days'),
  taxRatioNumerator: new Decimal('35'),
  taxRatioDenominator: new Decimal('1000')
};

const DeployedStakingPrograms = new Map<
  LatticeLpStaking,
  Awaited<ReturnType<typeof deployStakingContract>>
>();

const deployStakingContract = async (
  configuration: Partial<StakingContractConfiguration>
) => {
  const _configuration = lodash.merge(
    DefaultStakingContractConfiguration,
    configuration
  );

  const ownerAccount = await getOwnerAccount();

  const stakingToken = await deployTokenWithDecimals(
    _configuration.stakingTokenDecimals
  );
  const rewardToken = await deployTokenWithDecimals(
    _configuration.rewardTokenDecimals
  );

  const StakingContract = await ethers.getContractFactory(
    'LatticeLpStaking',
    ownerAccount
  );

  await waitForTransaction(
    rewardToken.mint(
      ownerAccount.address,
      dton(_configuration.programRewardAmount, rewardToken).toFixed()
    )
  );

  const staking = await StakingContract.deploy();

  await staking.deployTransaction.wait();

  await waitForTransaction(
    rewardToken.approve(
      staking.address,
      dton(_configuration.programRewardAmount, rewardToken).toFixed()
    )
  );

  await waitForTransaction(
    staking.initializeProgram(
      stakingToken.address,
      dton(_configuration.minStakingAmount, stakingToken).toFixed(),
      rewardToken.address,
      dton(_configuration.minRewardAmount, rewardToken).toFixed(),
      dton(_configuration.programRewardAmount, rewardToken).toFixed(),
      _configuration.programStartsAt.unix(),
      _configuration.programEndsAt.unix(),
      _configuration.taxRatioNumerator.toFixed(),
      _configuration.taxRatioDenominator.toFixed()
    )
  );

  DeployedStakingPrograms.set(staking, {
    staking,
    rewardToken,
    stakingToken,
    configuration: _configuration
  });

  return { staking, rewardToken, stakingToken, configuration: _configuration };
};

const resetDeployedStakingPrograms = () => {
  DeployedStakingPrograms.clear();
};

const getDeployedStakingContract = (staking: LatticeLpStaking) => {
  const stakingData = DeployedStakingPrograms.get(staking);

  if (!stakingData) {
    throw new Error('Unable to find staking program');
  }

  return stakingData;
};

export {
  deployStakingContract,
  resetDeployedStakingPrograms,
  getDeployedStakingContract
};
