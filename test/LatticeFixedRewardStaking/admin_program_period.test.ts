import {
  loadFixture,
  reset,
  time
} from '@nomicfoundation/hardhat-network-helpers';
import { expect } from 'chai';
import dayjs from 'dayjs';

import { LatticeFixedRewardStaking } from '../../typechain-types';
import { LatticeFixedRewardStakingFixtureUtils } from '../fixture_utils';
import { waitForTransaction } from '../utils';

describe('LatticeFixedRewardsStaking :: Admin Program Period', () => {
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

  describe('Update depletion date', () => {
    it('Can update program depletion date', async () => {
      const lastDepletionDate = dayjs.unix(
        (await stakingContract.programRewardsDepletionAt()).toNumber()
      );

      const nextDepletionDate = lastDepletionDate.add(1, 'day');

      await waitForTransaction(
        stakingContract.updateProgramDepletionDate(nextDepletionDate.unix())
      );

      await expect(
        stakingContract.programRewardsDepletionAt()
      ).to.eventually.equal(nextDepletionDate.unix());
    });

    it('Emits correct event on program depletion date update', async () => {
      const lastDepletionDate = dayjs.unix(
        (await stakingContract.programRewardsDepletionAt()).toNumber()
      );

      const nextDepletionDate = lastDepletionDate.add(1, 'day');

      await expect(
        stakingContract.updateProgramDepletionDate(nextDepletionDate.unix())
      )
        .to.emit(stakingContract, 'StakingConditionChanged')
        .withArgs(
          await stakingContract.programRewardRemaining(),
          await stakingContract.programLastAccruedRewardsAt(),
          nextDepletionDate.unix()
        );
    });

    describe('Reverts', () => {
      it('On bad program depletion date', async () => {
        const latestBlockAt = dayjs.unix(await time.latest());

        await expect(
          stakingContract.updateProgramDepletionDate(
            latestBlockAt.add(1, 'second').unix()
          )
        ).to.be.revertedWith(
          'New program depletion date must be greater than current time'
        );
      });
    });
  });

  describe('Accrue rewards period', () => {
    it('When program has no rewards, and no staked liquidity', async () => {
      const lastProgramAccruedRewardsAt = dayjs.unix(
        (await stakingContract.programLastAccruedRewardsAt()).toNumber()
      );

      const nextProgramAccruedRewardsAt = lastProgramAccruedRewardsAt.add(
        1,
        'day'
      );

      await time.setNextBlockTimestamp(nextProgramAccruedRewardsAt.unix());

      await waitForTransaction(stakingContract.accrueRewardsPeriod());

      await expect(
        stakingContract.programRewardPerLiquidity()
      ).to.eventually.equal(0);

      await expect(
        stakingContract.programRewardRemaining()
      ).to.eventually.equal(0);

      await expect(
        stakingContract.programLastAccruedRewardsAt()
      ).to.eventually.equal(nextProgramAccruedRewardsAt.unix());
    });
  });
});
