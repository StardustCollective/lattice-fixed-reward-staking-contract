import {
  loadFixture,
  reset,
  time
} from '@nomicfoundation/hardhat-network-helpers';
import { expect } from 'chai';
import dayjs from 'dayjs';
import Decimal from 'decimal.js';
import { ethers } from 'hardhat';

import { LatticeFixedRewardStaking, TestToken } from '../../typechain-types';
import {
  TestTokenFixtureUtils,
  LatticeFixedRewardStakingFixtureUtils
} from '../fixture_utils';
import { getOwnerAccount, waitForTransaction } from '../utils';

describe('LatticeFixedRewardsStaking :: Admin Program Rewards', () => {
  let stakingContract: LatticeFixedRewardStaking;
  let rewardToken: TestToken;
  let rewardTokenDecimals: number;

  const deployContract = async () => {
    stakingContract =
      await LatticeFixedRewardStakingFixtureUtils.deployContract();

    rewardToken = await ethers.getContractAt(
      'TestToken',
      await stakingContract.rewardToken(),
      await getOwnerAccount()
    );

    rewardTokenDecimals = await rewardToken.decimals();
  };

  before(async () => {
    await reset();
  });

  beforeEach(async () => {
    await loadFixture(deployContract);
  });

  describe('Deposit Rewards', () => {
    let rewardAmount: Decimal;

    beforeEach(async () => {
      rewardAmount = new Decimal('10000');

      await TestTokenFixtureUtils.mintAndApproveTokens({
        contract: rewardToken,
        minter: getOwnerAccount(),
        receiver: getOwnerAccount(),
        spender: stakingContract,
        amount: rewardAmount
      });
    });

    it('Can deposit program rewards', async () => {
      await expect(
        stakingContract.programRewardRemaining()
      ).to.eventually.equal(0);

      await expect(
        rewardToken.balanceOf(stakingContract.address)
      ).to.eventually.equal(0);

      await waitForTransaction(
        stakingContract.depositProgramRewards(
          rewardAmount.times(Decimal.pow(10, rewardTokenDecimals)).toFixed()
        )
      );

      await expect(
        stakingContract.programRewardRemaining()
      ).to.eventually.equal(
        rewardAmount.times(Decimal.pow(10, rewardTokenDecimals)).toFixed()
      );

      await expect(
        rewardToken.balanceOf(stakingContract.address)
      ).to.eventually.equal(
        rewardAmount.times(Decimal.pow(10, rewardTokenDecimals)).toFixed()
      );

      await expect(
        rewardToken.balanceOf((await getOwnerAccount()).address)
      ).to.eventually.equal(0);
    });

    it('Emits correct event on deposit program rewards', async () => {
      await expect(
        stakingContract.depositProgramRewards(
          rewardAmount.times(Decimal.pow(10, rewardTokenDecimals)).toFixed()
        )
      )
        .to.emit(stakingContract, 'StakingConditionChanged')
        .withArgs(
          rewardAmount.times(Decimal.pow(10, rewardTokenDecimals)).toFixed(),
          await stakingContract.programLastAccruedRewardsAt(),
          await stakingContract.programRewardsDepletionAt()
        );
    });

    describe('Reverts', () => {
      it('On bad amount specified', async () => {
        await expect(
          stakingContract.depositProgramRewards(0)
        ).to.be.rejectedWith('Unable to deposit 0 reward tokens');
      });

      it('On not enough funds', async () => {
        await expect(
          stakingContract.depositProgramRewards(
            rewardAmount
              .add(10000)
              .times(Decimal.pow(10, rewardTokenDecimals))
              .toFixed()
          )
        ).to.be.revertedWith('ERC20: insufficient allowance');
      });
    });
  });

  describe('Withdraw Rewards', () => {
    let rewardAmount: Decimal;

    beforeEach(async () => {
      rewardAmount = new Decimal('10000');

      await TestTokenFixtureUtils.mintAndApproveTokens({
        contract: rewardToken,
        minter: getOwnerAccount(),
        receiver: getOwnerAccount(),
        spender: stakingContract,
        amount: rewardAmount
      });

      await waitForTransaction(
        stakingContract.depositProgramRewards(
          rewardAmount.times(Decimal.pow(10, rewardTokenDecimals)).toFixed()
        )
      );
    });

    it('Can withdraw program rewards', async () => {
      await expect(
        stakingContract.programRewardRemaining()
      ).to.eventually.equal(
        rewardAmount.times(Decimal.pow(10, rewardTokenDecimals)).toFixed()
      );

      await expect(
        rewardToken.balanceOf(stakingContract.address)
      ).to.eventually.equal(
        rewardAmount.times(Decimal.pow(10, rewardTokenDecimals)).toFixed()
      );

      await waitForTransaction(
        stakingContract.withdrawProgramRewards(
          rewardAmount.times(Decimal.pow(10, rewardTokenDecimals)).toFixed()
        )
      );

      await expect(
        stakingContract.programRewardRemaining()
      ).to.eventually.equal(0);

      await expect(
        rewardToken.balanceOf(stakingContract.address)
      ).to.eventually.equal(0);

      await expect(
        rewardToken.balanceOf((await getOwnerAccount()).address)
      ).to.eventually.equal(
        rewardAmount.times(Decimal.pow(10, rewardTokenDecimals)).toFixed()
      );
    });

    it('Emits correct event on withdraw program rewards', async () => {
      await expect(
        stakingContract.withdrawProgramRewards(
          rewardAmount.times(Decimal.pow(10, rewardTokenDecimals)).toFixed()
        )
      )
        .to.emit(stakingContract, 'StakingConditionChanged')
        .withArgs(
          0,
          await stakingContract.programLastAccruedRewardsAt(),
          await stakingContract.programRewardsDepletionAt()
        );
    });

    describe('Reverts', () => {
      it('On bad amount specified', async () => {
        await expect(
          stakingContract.withdrawProgramRewards(0)
        ).to.be.rejectedWith('Unable to withdraw 0 reward tokens');
      });

      it('On not enough program rewards remaining', async () => {
        await expect(
          stakingContract.withdrawProgramRewards(
            rewardAmount
              .add(10000)
              .times(Decimal.pow(10, rewardTokenDecimals))
              .toFixed()
          )
        ).to.be.revertedWith(
          'Unable to withdraw more than the program reward remaining'
        );
      });
    });
  });

  describe('Withdraw Lost Rewards', () => {
    let rewardAmount: Decimal;
    let rewardAmountLost: Decimal;

    beforeEach(async () => {
      rewardAmount = new Decimal('30000');
      rewardAmountLost = new Decimal('1000');

      await TestTokenFixtureUtils.mintAndApproveTokens({
        contract: rewardToken,
        minter: getOwnerAccount(),
        receiver: getOwnerAccount(),
        spender: stakingContract,
        amount: rewardAmount
      });

      await waitForTransaction(
        stakingContract.depositProgramRewards(
          rewardAmount.times(Decimal.pow(10, rewardTokenDecimals)).toFixed()
        )
      );

      const lastProgramAccruedRewardsAt = dayjs.unix(
        (await stakingContract.programLastAccruedRewardsAt()).toNumber()
      );

      const nextProgramAccruedRewardsAt = lastProgramAccruedRewardsAt.add(
        1,
        'day'
      );

      await time.setNextBlockTimestamp(nextProgramAccruedRewardsAt.unix());

      await waitForTransaction(stakingContract.accrueRewardsPeriod());
    });

    it('Can withdraw lost program rewards', async () => {
      await expect(
        stakingContract.programRewardRemaining()
      ).to.eventually.equal(
        rewardAmount
          .minus(rewardAmountLost)
          .times(Decimal.pow(10, rewardTokenDecimals))
          .toFixed()
      );

      await expect(stakingContract.programRewardLost()).to.eventually.equal(
        rewardAmountLost.times(Decimal.pow(10, rewardTokenDecimals)).toFixed()
      );

      await expect(
        stakingContract.programRewardLostWithdrawn()
      ).to.eventually.equal(0);

      await expect(
        rewardToken.balanceOf(stakingContract.address)
      ).to.eventually.equal(
        rewardAmount.times(Decimal.pow(10, rewardTokenDecimals)).toFixed()
      );

      await waitForTransaction(
        stakingContract.withdrawProgramLostRewards(
          rewardAmountLost.times(Decimal.pow(10, rewardTokenDecimals)).toFixed()
        )
      );

      await expect(
        stakingContract.programRewardLostWithdrawn()
      ).to.eventually.equal(
        rewardAmountLost.times(Decimal.pow(10, rewardTokenDecimals)).toFixed()
      );

      await expect(
        rewardToken.balanceOf(stakingContract.address)
      ).to.eventually.equal(
        rewardAmount
          .minus(rewardAmountLost)
          .times(Decimal.pow(10, rewardTokenDecimals))
          .toFixed()
      );

      await expect(
        rewardToken.balanceOf((await getOwnerAccount()).address)
      ).to.eventually.equal(
        rewardAmountLost.times(Decimal.pow(10, rewardTokenDecimals)).toFixed()
      );
    });

    describe('Reverts', () => {
      it('On bad amount specified', async () => {
        await expect(
          stakingContract.withdrawProgramLostRewards(0)
        ).to.be.revertedWith('Unable to withdraw 0 lost rewards tokens');
      });

      it('On not enough lost rewards', async () => {
        await expect(
          stakingContract.withdrawProgramLostRewards(
            rewardAmountLost
              .add('1000')
              .times(Decimal.pow(10, rewardTokenDecimals))
              .toFixed()
          )
        ).to.be.revertedWith('Amount is greater than available lost rewards');
      });
    });
  });
});
