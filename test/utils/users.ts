import { Dayjs } from 'dayjs';
import Decimal from 'decimal.js';
import { time } from '@nomicfoundation/hardhat-network-helpers';

import { LatticeLpStaking } from '../../typechain-types';
import { User } from '../types';

import { getUserAccount } from './accounts';
import { getDeployedStakingContract } from './deployStakingContract';
import { dton } from './tokens';
import { waitForTransaction } from './transactions';

const stakeUser = async (
  user: User,
  amount: Decimal,
  claimRewards: boolean,
  transactionAt: Dayjs,
  staking: LatticeLpStaking
) => {
  const userAccount = await getUserAccount(user);

  const { stakingToken, rewardToken, configuration } =
    getDeployedStakingContract(staking);

  await waitForTransaction(
    stakingToken.mint(userAccount.address, dton(amount, stakingToken).toFixed())
  );

  await waitForTransaction(
    stakingToken
      .connect(userAccount)
      .approve(staking.address, dton(amount, stakingToken).toFixed())
  );

  await time.setNextBlockTimestamp(transactionAt.unix());

  return await waitForTransaction(
    staking
      .connect(userAccount)
      .stake(dton(amount, stakingToken).toFixed(), claimRewards)
  );
};

const withdrawUser = async (
  user: User,
  amount: Decimal,
  claimRewards: boolean,
  transactionAt: Dayjs,
  staking: LatticeLpStaking
) => {
  const userAccount = await getUserAccount(user);

  const { stakingToken, rewardToken, configuration } =
    getDeployedStakingContract(staking);

  await time.setNextBlockTimestamp(transactionAt.unix());

  return await waitForTransaction(
    staking
      .connect(userAccount)
      .withdraw(dton(amount, stakingToken).toFixed(), claimRewards)
  );
};

const claimRewardsUser = async (
  user: User,
  transactionAt: Dayjs,
  staking: LatticeLpStaking
) => {
  const userAccount = await getUserAccount(user);

  const { stakingToken, rewardToken, configuration } =
    getDeployedStakingContract(staking);

  await time.setNextBlockTimestamp(transactionAt.unix());

  return await waitForTransaction(staking.connect(userAccount).claimRewards());
};

export { stakeUser, withdrawUser, claimRewardsUser };
