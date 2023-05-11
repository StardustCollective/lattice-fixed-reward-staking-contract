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

describe('LatticeFixedRewardsStaking :: User Claim', () => {
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

    describe('Internal claim rewards function', () => {
      it('Claims existing rewards', async () => {
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
            .claimRewards()
        );

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

      it('Emits correct event on claimed existing rewards', async () => {
        await time.setNextBlockTimestamp(
          stakingParams.programStartsAt.add(3, 'days').unix()
        );

        await expect(
          stakingContract
            .connect(await getNamedAccount('user-a'))
            .claimRewards()
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

      describe('Reverts', () => {
        it('On not enough rewards to claim', async () => {
          await time.setNextBlockTimestamp(
            stakingParams.programStartsAt.add(0.5, 'days').unix()
          );

          await expect(
            stakingContract
              .connect(await getNamedAccount('user-a'))
              .claimRewards()
          ).to.be.rejectedWith('Not enough rewards to claim');
        });
      });
    });

    describe('Internal acrrue rewards period function', () => {
      it('Accrues correct rewards period');
    });

    describe('External available rewards function', () => {
      const rewardsPerDay = new Decimal('1000');

      const testCorrectRewardsAvailable = (callTimeInDays: number) => {
        it(
          'Reports correct rewards available at day ' + callTimeInDays,
          async () => {
            const totalRewards = rewardsPerDay.times(callTimeInDays);

            const userRewardsTaxed = totalRewards
              .times(
                new Decimal(
                  (await stakingContract.taxRatioDenominator()).toString()
                )
                  .minus((await stakingContract.taxRatioNumerator()).toString())
                  .div((await stakingContract.taxRatioDenominator()).toString())
              )
              .times(Decimal.pow(10, rewardTokenDecimals))
              .toFixed();

            const userTaxes = totalRewards
              .times(
                new Decimal(
                  (await stakingContract.taxRatioNumerator()).toString()
                ).div((await stakingContract.taxRatioDenominator()).toString())
              )
              .times(Decimal.pow(10, rewardTokenDecimals))
              .toFixed();

            await time.increaseTo(
              stakingParams.programStartsAt
                .add(callTimeInDays * 24, 'hours')
                .unix()
            );

            await expect(
              stakingContract.availableRewards(
                (
                  await getNamedAccount('user-a')
                ).address,
                { blockTag: 'latest' }
              )
            ).to.eventually.deep.equal(
              createNamedTuple(
                ['_userRewardsTaxed', userRewardsTaxed],
                ['_userTaxes', userTaxes]
              )
            );
          }
        );
      };

      testCorrectRewardsAvailable(0.5);
      testCorrectRewardsAvailable(1);
      testCorrectRewardsAvailable(3);
      testCorrectRewardsAvailable(10);
    });
  });
});
