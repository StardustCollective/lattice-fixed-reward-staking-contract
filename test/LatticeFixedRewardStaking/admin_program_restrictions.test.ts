import { loadFixture, reset } from '@nomicfoundation/hardhat-network-helpers';
import { expect } from 'chai';

import { LatticeFixedRewardStaking } from '../../typechain-types';
import { LatticeFixedRewardStakingFixtureUtils } from '../fixture_utils';
import { waitForTransaction } from '../utils';

describe('LatticeFixedRewardsStaking :: Admin Program Restrictions', () => {
  let stakingContract: LatticeFixedRewardStaking;

  const deployContract = async () => {
    stakingContract =
      await LatticeFixedRewardStakingFixtureUtils.deployContract();
  };

  before(async () => {
    await reset();
  });

  beforeEach(async () => {
    await loadFixture(deployContract);
  });

  it('Can update program staking restrictions', async () => {
    await waitForTransaction(stakingContract.updateProgramRestriction(0, 0));

    await expect(stakingContract.minStakingAmount()).to.eventually.equal(0);

    await expect(stakingContract.minRewardAmount()).to.eventually.equal(0);
  });

  it('Emits correct event on program restrictions update', async () => {
    await expect(stakingContract.updateProgramRestriction(0, 0))
      .to.emit(stakingContract, 'StakingRestrictionChanged')
      .withArgs(0, 0);
  });
});
