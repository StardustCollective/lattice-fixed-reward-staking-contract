import { reset, time } from '@nomicfoundation/hardhat-network-helpers';
import { expect } from 'chai';
import Decimal from 'decimal.js';

import {
  claimRewardsUser,
  deployStakingContract,
  dton,
  getUserAccount,
  ntod,
  resetDeployedStakingPrograms,
  resetDeployedTokens,
  stakeUser
} from './utils';

describe('Contract Staking Actions', function () {
  this.beforeEach(async function () {
    await reset();
    resetDeployedTokens();
    resetDeployedStakingPrograms();
  });

  describe('User A stakes from day 2 - 30', function () {
    describe('Generates an empty reward period', function () {
      it('with correct reward remaining', async function () {
        const userAccount = await getUserAccount('a');

        const { staking, stakingToken, rewardToken, configuration } =
          await deployStakingContract({});

        const stakingAmount = new Decimal('1000');

        await stakeUser(
          'a',
          stakingAmount,
          false,
          configuration.programStartsAt.add(2, 'days'),
          staking
        );

        const rewardRemaining = ntod(
          await staking.programRewardRemaining(),
          rewardToken
        );

        const expectedRewardForAccruedPeriod = configuration.programRewardAmount
          .mul(
            configuration.programStartsAt.add(2, 'days').unix() -
              configuration.programStartsAt.unix()
          )
          .div(
            configuration.programEndsAt.unix() -
              configuration.programStartsAt.unix()
          );

        const expectedRemainingReward = configuration.programRewardAmount.minus(
          expectedRewardForAccruedPeriod
        );

        expect(rewardRemaining.toFixed()).to.equal(
          expectedRemainingReward.toFixed()
        );
      });

      it('with correct reward lost', async function () {
        const userAccount = await getUserAccount('a');

        const { staking, stakingToken, rewardToken, configuration } =
          await deployStakingContract({});

        const stakingAmount = new Decimal('1000');

        await stakeUser(
          'a',
          stakingAmount,
          false,
          configuration.programStartsAt.add(2, 'days'),
          staking
        );

        const rewardLost = ntod(await staking.programRewardLost(), rewardToken);

        const expectedRewardLost = configuration.programRewardAmount
          .mul(
            configuration.programStartsAt.add(2, 'days').unix() -
              configuration.programStartsAt.unix()
          )
          .div(
            configuration.programEndsAt.unix() -
              configuration.programStartsAt.unix()
          );

        expect(rewardLost.toFixed()).to.equal(expectedRewardLost.toFixed());
      });

      it('with correct reward per liquidity', async function () {
        const userAccount = await getUserAccount('a');

        const { staking, stakingToken, rewardToken, configuration } =
          await deployStakingContract({});

        const stakingAmount = new Decimal('1000');

        const previousStakedAmount = ntod(
          await staking.stakingTokenBalance(),
          stakingToken
        );

        const previousRewardPerLiquidity = ntod(
          await staking.programRewardPerLiquidity(),
          rewardToken
        );

        await stakeUser(
          'a',
          stakingAmount,
          false,
          configuration.programStartsAt.add(2, 'days'),
          staking
        );

        const rewardPerLiquidity = ntod(
          await staking.programRewardPerLiquidity(),
          rewardToken
        );

        const magnitudeConstant = new Decimal(
          (await staking.MAGNITUDE_CONSTANT()).toString()
        );

        const expectedRewardForAccruedPeriod = configuration.programRewardAmount
          .mul(
            configuration.programStartsAt.add(2, 'days').unix() -
              configuration.programStartsAt.unix()
          )
          .div(
            configuration.programEndsAt.unix() -
              configuration.programStartsAt.unix()
          );

        const expectedRewardPerLiquidity = previousRewardPerLiquidity.add(
          dton(previousStakedAmount, stakingToken).isZero()
            ? new Decimal(0)
            : dton(expectedRewardForAccruedPeriod, rewardToken)
                .times(magnitudeConstant)
                .div(dton(previousStakedAmount, stakingToken))
        );

        expect(rewardPerLiquidity.toFixed()).to.equal(
          expectedRewardPerLiquidity.toFixed()
        );
      });
    });

    it('Informs correct reward amount', async function () {
      const userAccount = await getUserAccount('a');

      const { staking, stakingToken, rewardToken, configuration } =
        await deployStakingContract({});

      const stakingAmount = new Decimal('1000');

      await stakeUser(
        'a',
        stakingAmount,
        false,
        configuration.programStartsAt.add(2, 'days'),
        staking
      );

      await time.increaseTo(
        configuration.programStartsAt.add(6, 'days').unix()
      );

      const availableRewards = await staking.availableRewards(
        userAccount.address
      );

      const totalAvailableRewards = ntod(
        availableRewards._userRewardsTaxed,
        rewardToken
      ).plus(ntod(availableRewards._userTaxes, rewardToken));

      expect(totalAvailableRewards.toFixed()).to.equal('4000');
    });

    it('Claims rewards with the correct amount', async function () {
      const userAccount = await getUserAccount('a');

      const { staking, stakingToken, rewardToken, configuration } =
        await deployStakingContract({});

      const stakingAmount = new Decimal('1000');

      await stakeUser(
        'a',
        stakingAmount,
        false,
        configuration.programStartsAt.add(2, 'days'),
        staking
      );

      await claimRewardsUser(
        'a',
        configuration.programStartsAt.add(40, 'days'),
        staking
      );

      const rewardsClaimed = ntod(
        await rewardToken.balanceOf(userAccount.address),
        rewardToken
      );

      expect(rewardsClaimed.toFixed()).to.equal(
        new Decimal('28000')
          .minus(new Decimal('28000').times('0.035'))
          .toFixed()
      );
    });
  });
});
