import {
  loadFixture,
  reset,
  time
} from '@nomicfoundation/hardhat-network-helpers';
import { expect } from 'chai';
import Decimal from 'decimal.js';

import { LatticeFixedRewardStaking } from '../../typechain-types';
import { LatticeFixedRewardStakingFixtureUtils } from '../fixture_utils';
import {
  createNamedTuple,
  getNamedAccount,
  getOwnerAccount,
  waitForTransaction
} from '../utils';

describe('LatticeFixedRewardsStaking :: User Withdraw', () => {
  let programRewardAmount: Decimal;
  let magnitudeConstant: Decimal;
  let stakingParams: Awaited<
    ReturnType<
      typeof LatticeFixedRewardStakingFixtureUtils.deployContract.getDefaultResolvedParams
    >
  >;
  let stakingContract: LatticeFixedRewardStaking;

  const deployContract = async () => {
    programRewardAmount = new Decimal('30000');
    stakingParams =
      await LatticeFixedRewardStakingFixtureUtils.deployContract.getDefaultResolvedParams();
    stakingContract =
      await LatticeFixedRewardStakingFixtureUtils.deployContract(stakingParams);

    magnitudeConstant = new Decimal(
      (await stakingContract.MAGNITUDE_CONSTANT()).toString()
    );

    await LatticeFixedRewardStakingFixtureUtils.mintRewards({
      rewardAmount: programRewardAmount,
      stakingContract,
      minter: getOwnerAccount(),
      receiver: getOwnerAccount()
    });
  };

  before(async () => {
    await reset();
  });

  beforeEach(async () => {
    await loadFixture(deployContract);
  });

  describe('Single user flow', () => {
    let userStakingAmount: Decimal;
    let userRewardAmount: Decimal;
    let stakingTokenDecimals: number;
    let rewardTokenDecimals: number;

    beforeEach(async () => {
      userStakingAmount = new Decimal('1000');
      userRewardAmount = new Decimal('3000');

      stakingTokenDecimals = await stakingParams.stakingToken.decimals();
      rewardTokenDecimals = await stakingParams.rewardToken.decimals();

      await LatticeFixedRewardStakingFixtureUtils.stakeUser({
        stakingContract,
        stakingAmount: userStakingAmount,
        stakingAccount: getNamedAccount('user-a'),
        stakingTime: stakingParams.programStartsAt,
        minter: getOwnerAccount(),
        claimExistingRewards: false
      });
    });

    describe('Internal withdraw function', () => {
      it('Can withdraw tokens', async () => {
        await expect(
          stakingParams.stakingToken.balanceOf(
            (
              await getNamedAccount('user-a')
            ).address
          )
        ).to.eventually.equal(0);

        await expect(
          stakingParams.rewardToken.balanceOf(
            (
              await getNamedAccount('user-a')
            ).address
          )
        ).to.eventually.equal(0);

        await expect(
          stakingParams.stakingToken.balanceOf(stakingContract.address)
        ).to.eventually.equal(
          userStakingAmount
            .times(Decimal.pow(10, stakingTokenDecimals))
            .toFixed()
        );

        await expect(
          stakingContract.programStakedLiquidity()
        ).to.eventually.equal(
          userStakingAmount
            .times(Decimal.pow(10, stakingTokenDecimals))
            .toFixed()
        );

        await expect(
          stakingContract.users((await getNamedAccount('user-a')).address)
        ).to.eventually.deep.equal(
          createNamedTuple(
            [
              'amountStaked',
              userStakingAmount
                .times(Decimal.pow(10, stakingTokenDecimals))
                .toFixed()
            ],
            ['lastProgramRewardPerLiquidity', 0]
          )
        );

        await time.setNextBlockTimestamp(
          stakingParams.programStartsAt.add(3, 'days').unix()
        );

        await waitForTransaction(
          stakingContract
            .connect(await getNamedAccount('user-a'))
            .withdraw(
              userStakingAmount
                .times(Decimal.pow(10, stakingTokenDecimals))
                .toFixed(),
              false,
              false
            )
        );

        await expect(
          stakingParams.stakingToken.balanceOf(
            (
              await getNamedAccount('user-a')
            ).address
          )
        ).to.eventually.equal(
          userStakingAmount
            .times(Decimal.pow(10, stakingTokenDecimals))
            .toFixed()
        );

        await expect(
          stakingParams.rewardToken.balanceOf(
            (
              await getNamedAccount('user-a')
            ).address
          )
        ).to.eventually.equal(
          userRewardAmount
            .times(
              new Decimal(
                (await stakingContract.taxRatioDenominator()).toString()
              )
                .minus((await stakingContract.taxRatioNumerator()).toString())
                .div((await stakingContract.taxRatioDenominator()).toString())
            )
            .times(Decimal.pow(10, rewardTokenDecimals))
            .toFixed()
        );

        await expect(stakingContract.taxAccumulated()).to.eventually.equal(
          userRewardAmount
            .times(
              new Decimal(
                (await stakingContract.taxRatioNumerator()).toString()
              ).div((await stakingContract.taxRatioDenominator()).toString())
            )
            .times(Decimal.pow(10, rewardTokenDecimals))
            .toFixed()
        );

        await expect(
          stakingParams.stakingToken.balanceOf(stakingContract.address)
        ).to.eventually.equal(0);

        await expect(
          stakingContract.programStakedLiquidity()
        ).to.eventually.equal(0);

        await expect(
          stakingContract.users((await getNamedAccount('user-a')).address)
        ).to.eventually.deep.equal(
          createNamedTuple(
            ['amountStaked', 0],
            [
              'lastProgramRewardPerLiquidity',
              userRewardAmount
                .times(Decimal.pow(10, rewardTokenDecimals))
                .times(magnitudeConstant)
                .div(
                  userStakingAmount.times(Decimal.pow(10, stakingTokenDecimals))
                )
                .toFixed()
            ]
          )
        );

        await expect(
          stakingContract.programRewardRemaining()
        ).to.eventually.equal(
          programRewardAmount
            .minus(userRewardAmount)
            .times(Decimal.pow(10, rewardTokenDecimals))
            .toFixed()
        );

        await expect(
          stakingContract.programLastAccruedRewardsAt()
        ).to.eventually.equal(
          stakingParams.programStartsAt.add(3, 'days').unix()
        );
      });

      it('Emits correct event on withdraw tokens', async () => {
        await time.setNextBlockTimestamp(
          stakingParams.programStartsAt.add(3, 'days').unix()
        );

        await expect(
          stakingContract
            .connect(await getNamedAccount('user-a'))
            .withdraw(
              userStakingAmount
                .times(Decimal.pow(10, stakingTokenDecimals))
                .toFixed(),
              false,
              false
            )
        )
          .to.emit(stakingContract, 'Withdrawn')
          .withArgs(
            (
              await getNamedAccount('user-a')
            ).address,
            userStakingAmount
              .times(Decimal.pow(10, stakingTokenDecimals))
              .toFixed()
          );
      });

      describe('Reverts', () => {
        it('On contract paused', async () => {
          await waitForTransaction(stakingContract.pause());

          await time.setNextBlockTimestamp(
            stakingParams.programStartsAt.add(3, 'days').unix()
          );

          await expect(
            stakingContract
              .connect(await getNamedAccount('user-a'))
              .withdraw(
                userStakingAmount
                  .times(Decimal.pow(10, stakingTokenDecimals))
                  .toFixed(),
                false,
                false
              )
          ).to.be.revertedWith('Pausable: paused');
        });

        it('On bad amount specified', async () => {
          await time.setNextBlockTimestamp(
            stakingParams.programStartsAt.add(3, 'days').unix()
          );

          await expect(
            stakingContract
              .connect(await getNamedAccount('user-a'))
              .withdraw(0, false, false)
          ).to.be.revertedWith('Unable to withdraw 0 tokens');
        });

        it('On amount is greater than staked', async () => {
          await time.setNextBlockTimestamp(
            stakingParams.programStartsAt.add(3, 'days').unix()
          );

          await expect(
            stakingContract
              .connect(await getNamedAccount('user-a'))
              .withdraw(
                userStakingAmount
                  .add('1000')
                  .times(Decimal.pow(10, stakingTokenDecimals))
                  .toFixed(),
                false,
                false
              )
          ).to.be.revertedWith('Amount to withdraw is greater than staked');
        });

        it('On no staked tokens', async () => {
          await time.setNextBlockTimestamp(
            stakingParams.programStartsAt.add(3, 'days').unix()
          );

          await expect(
            stakingContract
              .connect(await getNamedAccount('user-b'))
              .withdraw(
                userStakingAmount
                  .times(Decimal.pow(10, stakingTokenDecimals))
                  .toFixed(),
                false,
                false
              )
          ).to.be.revertedWith('No amount to withdraw');
        });

        it('On invalid partial final amount specified by the program', async () => {
          await time.setNextBlockTimestamp(
            stakingParams.programStartsAt.add(3, 'days').unix()
          );

          await expect(
            stakingContract
              .connect(await getNamedAccount('user-a'))
              .withdraw(
                userStakingAmount
                  .minus(stakingParams.minStakingAmount.minus(1))
                  .times(Decimal.pow(10, stakingTokenDecimals))
                  .toFixed(),
                false,
                false
              )
          ).to.be.revertedWith(
            'The final staked amount would be less than required by the specified program'
          );
        });
      });
    });

    describe('Internal claim rewards function', () => {
      it('Claims existing rewards');

      it('Emits correct event on claimed existing rewards', async () => {
        await time.setNextBlockTimestamp(
          stakingParams.programStartsAt.add(3, 'days').unix()
        );

        await expect(
          stakingContract
            .connect(await getNamedAccount('user-a'))
            .withdraw(
              userStakingAmount
                .times(Decimal.pow(10, stakingTokenDecimals))
                .toFixed(),
              false,
              false
            )
        )
          .to.emit(stakingContract, 'RewardsClaimed')
          .withArgs(
            (
              await getNamedAccount('user-a')
            ).address,
            userRewardAmount
              .times(
                new Decimal(
                  (await stakingContract.taxRatioDenominator()).toString()
                )
                  .minus((await stakingContract.taxRatioNumerator()).toString())
                  .div((await stakingContract.taxRatioDenominator()).toString())
              )
              .times(Decimal.pow(10, rewardTokenDecimals))
              .toFixed(),
            userRewardAmount
              .times(
                new Decimal(
                  (await stakingContract.taxRatioNumerator()).toString()
                ).div((await stakingContract.taxRatioDenominator()).toString())
              )
              .times(Decimal.pow(10, rewardTokenDecimals))
              .toFixed()
          );
      });

      it('Waives existing rewards', async () => {
        await expect(
          stakingParams.stakingToken.balanceOf(
            (
              await getNamedAccount('user-a')
            ).address
          )
        ).to.eventually.equal(0);

        await expect(
          stakingParams.rewardToken.balanceOf(
            (
              await getNamedAccount('user-a')
            ).address
          )
        ).to.eventually.equal(0);

        await expect(
          stakingParams.stakingToken.balanceOf(stakingContract.address)
        ).to.eventually.equal(
          userStakingAmount
            .times(Decimal.pow(10, stakingTokenDecimals))
            .toFixed()
        );

        await expect(
          stakingContract.programStakedLiquidity()
        ).to.eventually.equal(
          userStakingAmount
            .times(Decimal.pow(10, stakingTokenDecimals))
            .toFixed()
        );

        await expect(
          stakingContract.users((await getNamedAccount('user-a')).address)
        ).to.eventually.deep.equal(
          createNamedTuple(
            [
              'amountStaked',
              userStakingAmount
                .times(Decimal.pow(10, stakingTokenDecimals))
                .toFixed()
            ],
            ['lastProgramRewardPerLiquidity', 0]
          )
        );

        await time.setNextBlockTimestamp(
          stakingParams.programStartsAt.add(3, 'days').unix()
        );

        await waitForTransaction(
          stakingContract
            .connect(await getNamedAccount('user-a'))
            .withdraw(
              userStakingAmount
                .times(Decimal.pow(10, stakingTokenDecimals))
                .toFixed(),
              true,
              true
            )
        );

        await expect(
          stakingParams.stakingToken.balanceOf(
            (
              await getNamedAccount('user-a')
            ).address
          )
        ).to.eventually.equal(
          userStakingAmount
            .times(Decimal.pow(10, stakingTokenDecimals))
            .toFixed()
        );

        await expect(
          stakingParams.rewardToken.balanceOf(
            (
              await getNamedAccount('user-a')
            ).address
          )
        ).to.eventually.equal(0);

        await expect(stakingContract.taxAccumulated()).to.eventually.equal(0);

        await expect(stakingContract.programRewardLost()).to.eventually.equal(
          userRewardAmount.times(Decimal.pow(10, rewardTokenDecimals)).toFixed()
        );

        await expect(
          stakingParams.stakingToken.balanceOf(stakingContract.address)
        ).to.eventually.equal(0);

        await expect(
          stakingContract.programStakedLiquidity()
        ).to.eventually.equal(0);

        await expect(
          stakingContract.users((await getNamedAccount('user-a')).address)
        ).to.eventually.deep.equal(
          createNamedTuple(
            ['amountStaked', 0],
            [
              'lastProgramRewardPerLiquidity',
              userRewardAmount
                .times(Decimal.pow(10, rewardTokenDecimals))
                .times(magnitudeConstant)
                .div(
                  userStakingAmount.times(Decimal.pow(10, stakingTokenDecimals))
                )
                .toFixed()
            ]
          )
        );

        await expect(
          stakingContract.programRewardRemaining()
        ).to.eventually.equal(
          programRewardAmount
            .minus(userRewardAmount)
            .times(Decimal.pow(10, rewardTokenDecimals))
            .toFixed()
        );

        await expect(
          stakingContract.programLastAccruedRewardsAt()
        ).to.eventually.equal(
          stakingParams.programStartsAt.add(3, 'days').unix()
        );
      });

      it('Emits correct event on waived existing rewards', async () => {
        await time.setNextBlockTimestamp(
          stakingParams.programStartsAt.add(3, 'days').unix()
        );

        await expect(
          stakingContract
            .connect(await getNamedAccount('user-a'))
            .withdraw(
              userStakingAmount
                .times(Decimal.pow(10, stakingTokenDecimals))
                .toFixed(),
              true,
              true
            )
        )
          .to.emit(stakingContract, 'RewardsLost')
          .withArgs(
            userRewardAmount
              .times(Decimal.pow(10, rewardTokenDecimals))
              .toFixed()
          );
      });

      describe('Reverts', () => {
        it('On not enough rewards to claim');
      });
    });

    describe('Internal save rewards function', () => {
      it('Saves existing rewards');
    });

    describe('Internal accrue rewards period function', () => {
      it('Accrues correct rewards period', async () => {
        await expect(
          stakingContract.programLastAccruedRewardsAt()
        ).to.eventually.equal(stakingParams.programStartsAt.unix());

        await expect(
          stakingContract.programRewardPerLiquidity()
        ).to.eventually.equal(0);

        await expect(
          stakingContract.programRewardRemaining()
        ).to.eventually.equal(
          programRewardAmount
            .times(Decimal.pow(10, rewardTokenDecimals))
            .toFixed()
        );

        await time.setNextBlockTimestamp(
          stakingParams.programStartsAt.add(3, 'days').unix()
        );

        await waitForTransaction(
          stakingContract
            .connect(await getNamedAccount('user-a'))
            .withdraw(
              userStakingAmount
                .times(Decimal.pow(10, stakingTokenDecimals))
                .toFixed(),
              false,
              false
            )
        );

        await expect(
          stakingContract.programLastAccruedRewardsAt()
        ).to.eventually.equal(
          stakingParams.programStartsAt.add(3, 'days').unix()
        );

        await expect(
          stakingContract.programRewardPerLiquidity()
        ).to.eventually.equal(
          userRewardAmount
            .times(Decimal.pow(10, rewardTokenDecimals))
            .times(magnitudeConstant)
            .div(userStakingAmount.times(Decimal.pow(10, stakingTokenDecimals)))
            .toFixed()
        );

        await expect(
          stakingContract.programRewardRemaining()
        ).to.eventually.equal(
          programRewardAmount
            .minus(userRewardAmount)
            .times(Decimal.pow(10, rewardTokenDecimals))
            .toFixed()
        );
      });
    });
  });
});
