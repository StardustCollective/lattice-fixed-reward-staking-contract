import { loadFixture, reset } from '@nomicfoundation/hardhat-network-helpers';
import { expect } from 'chai';
import Decimal from 'decimal.js';

import { LatticeFixedRewardStaking } from '../../typechain-types';
import { LatticeFixedRewardStakingFixtureUtils } from '../fixture_utils';
import { getNamedAccount, getOwnerAccount, waitForTransaction } from '../utils';

describe('LatticeFixedRewardsStaking :: Admin Program Taxes', () => {
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

  describe('Withdraw Program Taxes', () => {
    let userStakingAmount: Decimal;
    let userRewardAmount: Decimal;
    let rewardTokenDecimals: number;

    beforeEach(async () => {
      userStakingAmount = new Decimal('1000');
      userRewardAmount = new Decimal('3000');

      rewardTokenDecimals = await stakingParams.rewardToken.decimals();

      await LatticeFixedRewardStakingFixtureUtils.stakeUser({
        stakingContract,
        stakingAmount: userStakingAmount,
        stakingAccount: getNamedAccount('user-a'),
        stakingTime: stakingParams.programStartsAt,
        minter: getOwnerAccount(),
        claimExistingRewards: false
      });

      await LatticeFixedRewardStakingFixtureUtils.withdrawUser({
        stakingContract,
        stakingAmount: userStakingAmount,
        stakingAccount: getNamedAccount('user-a'),
        stakingTime: stakingParams.programStartsAt.add(3, 'days'),
        claimExistingRewards: false,
        waiveExistingRewards: false
      });
    });

    it('Can withdraw program taxes', async () => {
      await expect(
        stakingParams.rewardToken.balanceOf((await getOwnerAccount()).address)
      ).to.eventually.equal(0);

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
        stakingContract.taxAccumulatedWithdrawn()
      ).to.eventually.equal(0);

      await waitForTransaction(
        stakingContract.withdrawProgramTaxes(
          userRewardAmount
            .times(
              new Decimal(
                (await stakingContract.taxRatioNumerator()).toString()
              ).div((await stakingContract.taxRatioDenominator()).toString())
            )
            .times(Decimal.pow(10, rewardTokenDecimals))
            .toFixed()
        )
      );

      await expect(
        stakingParams.rewardToken.balanceOf((await getOwnerAccount()).address)
      ).to.eventually.equal(
        userRewardAmount
          .times(
            new Decimal(
              (await stakingContract.taxRatioNumerator()).toString()
            ).div((await stakingContract.taxRatioDenominator()).toString())
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
        stakingContract.taxAccumulatedWithdrawn()
      ).to.eventually.equal(
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
      it('On bad amount specified', async () => {
        await expect(
          stakingContract.withdrawProgramTaxes(0)
        ).to.be.revertedWith('Unable to withdraw 0 program taxes');
      });

      it('On not enough program taxes', async () => {
        await expect(
          stakingContract.withdrawProgramTaxes(
            userRewardAmount
              .times(
                new Decimal(
                  (await stakingContract.taxRatioNumerator()).toString()
                ).div((await stakingContract.taxRatioDenominator()).toString())
              )
              .plus(100)
              .times(Decimal.pow(10, rewardTokenDecimals))
              .toFixed()
          )
        ).to.be.revertedWith('Amount is greater than available taxes');
      });
    });
  });

  describe('Update Program Tax', () => {
    it('Can update program tax', async () => {
      await expect(stakingContract.taxRatioNumerator()).to.eventually.equal(10);

      await expect(stakingContract.taxRatioDenominator()).to.eventually.equal(
        100
      );

      await waitForTransaction(stakingContract.updateProgramTax(5, 1000));

      await expect(stakingContract.taxRatioNumerator()).to.eventually.equal(5);

      await expect(stakingContract.taxRatioDenominator()).to.eventually.equal(
        1000
      );
    });

    it('Emits correct event on program tax update', async () => {
      await expect(stakingContract.updateProgramTax(5, 1000))
        .to.emit(stakingContract, 'TaxConditionChanged')
        .withArgs(5, 1000);
    });

    describe('Reverts', () => {
      it('On bad tax ratio specified', async () => {
        await expect(
          stakingContract.updateProgramTax(20, 100)
        ).to.be.revertedWith('Tax ratio exceeds 10% cap');
      });
    });
  });
});
