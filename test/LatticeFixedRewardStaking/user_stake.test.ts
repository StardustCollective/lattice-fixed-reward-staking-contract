import {
  loadFixture,
  reset,
  time
} from '@nomicfoundation/hardhat-network-helpers';
import { expect } from 'chai';
import Decimal from 'decimal.js';

import { LatticeFixedRewardStaking } from '../../typechain-types';
import {
  LatticeFixedRewardStakingFixtureUtils,
  TestTokenFixtureUtils
} from '../fixture_utils';
import {
  createNamedTuple,
  getNamedAccount,
  getOwnerAccount,
  waitForTransaction
} from '../utils';

describe('LatticeFixedRewardsStaking :: User Stake', () => {
  let programRewardAmount: Decimal;
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
    let stakingAmount: Decimal;
    let stakingTokenDecimals: number;
    let rewardTokenDecimals: number;

    beforeEach(async () => {
      stakingAmount = new Decimal('1000');

      stakingTokenDecimals = await stakingParams.stakingToken.decimals();
      rewardTokenDecimals = await stakingParams.rewardToken.decimals();

      await TestTokenFixtureUtils.mintAndApproveTokens({
        contract: stakingParams.stakingToken,
        minter: getOwnerAccount(),
        receiver: getNamedAccount('user-a'),
        spender: stakingContract,
        amount: stakingAmount
      });
    });

    describe('Internal stake function', () => {
      it('Can stake tokens', async () => {
        await expect(
          stakingParams.stakingToken.balanceOf(
            (
              await getNamedAccount('user-a')
            ).address
          )
        ).to.eventually.equal(
          stakingAmount.times(Decimal.pow(10, stakingTokenDecimals)).toFixed()
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
            ['lastProgramRewardPerLiquidity', 0]
          )
        );

        await time.setNextBlockTimestamp(stakingParams.programStartsAt.unix());

        await waitForTransaction(
          stakingContract
            .connect(await getNamedAccount('user-a'))
            .stake(
              stakingAmount
                .times(Decimal.pow(10, stakingTokenDecimals))
                .toFixed(),
              false
            )
        );

        await expect(
          stakingParams.stakingToken.balanceOf(
            (
              await getNamedAccount('user-a')
            ).address
          )
        ).to.eventually.equal(0);

        await expect(
          stakingParams.stakingToken.balanceOf(stakingContract.address)
        ).to.eventually.equal(
          stakingAmount.times(Decimal.pow(10, stakingTokenDecimals)).toFixed()
        );

        await expect(
          stakingContract.programStakedLiquidity()
        ).to.eventually.equal(
          stakingAmount.times(Decimal.pow(10, stakingTokenDecimals)).toFixed()
        );

        await expect(
          stakingContract.users((await getNamedAccount('user-a')).address)
        ).to.eventually.deep.equal(
          createNamedTuple(
            [
              'amountStaked',
              stakingAmount
                .times(Decimal.pow(10, stakingTokenDecimals))
                .toFixed()
            ],
            ['lastProgramRewardPerLiquidity', 0]
          )
        );
      });

      it('Emits correct event on staked tokens', async () => {
        await time.setNextBlockTimestamp(stakingParams.programStartsAt.unix());

        await expect(
          stakingContract
            .connect(await getNamedAccount('user-a'))
            .stake(
              stakingAmount
                .times(Decimal.pow(10, stakingTokenDecimals))
                .toFixed(),
              false
            )
        )
          .to.emit(stakingContract, 'Staked')
          .withArgs(
            (
              await getNamedAccount('user-a')
            ).address,
            stakingAmount.times(Decimal.pow(10, stakingTokenDecimals)).toFixed()
          );
      });

      describe('Reverts', () => {
        it('On contract paused', async () => {
          await waitForTransaction(stakingContract.pause());

          await time.setNextBlockTimestamp(
            stakingParams.programStartsAt.unix()
          );

          await expect(
            stakingContract
              .connect(await getNamedAccount('user-a'))
              .stake(
                stakingAmount
                  .times(Decimal.pow(10, stakingTokenDecimals))
                  .toFixed(),
                false
              )
          ).to.be.revertedWith('Pausable: paused');
        });

        it('On program not started yet', async () => {
          await loadFixture(deployContract);

          await time.setNextBlockTimestamp(
            stakingParams.programStartsAt.add(-1, 'day').unix()
          );

          await expect(
            stakingContract
              .connect(await getNamedAccount('user-a'))
              .stake(
                stakingAmount
                  .times(Decimal.pow(10, stakingTokenDecimals))
                  .toFixed(),
                false
              )
          ).to.be.revertedWith('Staking program not open yet');
        });

        it('On no rewards available', async () => {
          await waitForTransaction(
            stakingContract.withdrawProgramRewards(
              programRewardAmount
                .times(Decimal.pow(10, rewardTokenDecimals))
                .toFixed()
            )
          );

          await time.setNextBlockTimestamp(
            stakingParams.programStartsAt.unix()
          );

          await expect(
            stakingContract
              .connect(await getNamedAccount('user-a'))
              .stake(
                stakingAmount
                  .times(Decimal.pow(10, stakingTokenDecimals))
                  .toFixed(),
                false
              )
          ).to.be.revertedWith('There are no rewards deposited yet');
        });

        it('On staking program finished', async () => {
          await time.setNextBlockTimestamp(
            stakingParams.programDepletionDateAt.unix()
          );

          await expect(
            stakingContract
              .connect(await getNamedAccount('user-a'))
              .stake(
                stakingAmount
                  .times(Decimal.pow(10, stakingTokenDecimals))
                  .toFixed(),
                false
              )
          ).to.be.revertedWith('Staking program has closed');
        });

        it('On invalid amount to stake', async () => {
          await time.setNextBlockTimestamp(
            stakingParams.programStartsAt.unix()
          );

          await expect(
            stakingContract
              .connect(await getNamedAccount('user-a'))
              .stake(0, false)
          ).to.be.revertedWith('Unable to stake 0 tokens');
        });

        it('On amount less than required by program', async () => {
          await time.setNextBlockTimestamp(
            stakingParams.programStartsAt.unix()
          );

          await expect(
            stakingContract
              .connect(await getNamedAccount('user-a'))
              .stake(
                stakingParams.minStakingAmount
                  .minus(1)
                  .times(Decimal.pow(10, stakingTokenDecimals))
                  .toFixed(),
                false
              )
          ).to.be.revertedWith(
            'Staking less than required by the specified program'
          );
        });

        it('On not enough funds', async () => {
          await time.setNextBlockTimestamp(
            stakingParams.programStartsAt.unix()
          );

          await expect(
            stakingContract
              .connect(await getNamedAccount('user-a'))
              .stake(
                stakingAmount
                  .plus(1000)
                  .times(Decimal.pow(10, stakingTokenDecimals))
                  .toFixed(),
                false
              )
          ).to.be.revertedWith('ERC20: insufficient allowance');
        });
      });
    });

    describe('Internal claim rewards function', () => {
      it('Claims existing rewards');

      it('Emits correct event on claimed existing rewards');

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

        await time.setNextBlockTimestamp(stakingParams.programStartsAt.unix());

        await waitForTransaction(
          stakingContract
            .connect(await getNamedAccount('user-a'))
            .stake(
              stakingAmount
                .times(Decimal.pow(10, stakingTokenDecimals))
                .toFixed(),
              false
            )
        );

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
      });
    });
  });
});
