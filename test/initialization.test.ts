import { reset } from '@nomicfoundation/hardhat-network-helpers';
import { expect } from 'chai';

import {
  deployStakingContract,
  getOwnerAccount,
  ntod,
  resetDeployedStakingPrograms,
  resetDeployedTokens
} from './utils';

describe('Contract Initialization', function () {
  this.beforeEach(async function () {
    await reset();
    resetDeployedTokens();
    resetDeployedStakingPrograms();
  });

  it('Transfers correct amount to staking contract', async function () {
    const ownerAccount = await getOwnerAccount();

    const { staking, stakingToken, rewardToken, configuration } =
      await deployStakingContract({});

    const stakingBalance = ntod(
      await rewardToken.balanceOf(staking.address),
      rewardToken
    );
    const ownerBalance = ntod(
      await rewardToken.balanceOf(ownerAccount.address),
      rewardToken
    );

    expect(stakingBalance.toFixed()).to.equal(
      configuration.programRewardAmount.toFixed()
    );
    expect(ownerBalance.toFixed()).to.equal('0');
  });

  it('Sets correct start / end dates', async function () {
    const ownerAccount = await getOwnerAccount();

    const { staking, stakingToken, rewardToken, configuration } =
      await deployStakingContract({});

    const stakingStartsAt = (await staking.programStartsAt()).toNumber();
    const stakingEndsAt = (await staking.programEndsAt()).toNumber();

    expect(stakingStartsAt).to.equal(configuration.programStartsAt.unix());
    expect(stakingEndsAt).to.equal(configuration.programEndsAt.unix());
  });

  it('Sets correct last accrued rewards at', async function () {
    const ownerAccount = await getOwnerAccount();

    const { staking, stakingToken, rewardToken, configuration } =
      await deployStakingContract({});

    const lastAccruedRewardsAt = (
      await staking.programLastAccruedRewardsAt()
    ).toNumber();

    expect(lastAccruedRewardsAt).to.equal(configuration.programStartsAt.unix());
  });
});
