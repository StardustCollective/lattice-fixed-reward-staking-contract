import { loadFixture, reset } from '@nomicfoundation/hardhat-network-helpers';
import { expect } from 'chai';
import Decimal from 'decimal.js';
import { BigNumber } from 'ethers';
import { ethers } from 'hardhat';

import {
  LatticeFixedRewardStaking,
  LatticeFixedRewardStaking__factory
} from '../../typechain-types';
import { LatticeFixedRewardStakingFixtureUtils } from '../fixture_utils';
import { getNamedAccount, getOwnerAccount } from '../utils';

describe('LatticeFixedRewardsStaking :: Deployment', () => {
  let stakingContract: LatticeFixedRewardStaking;
  let resolvedParams: Awaited<
    ReturnType<
      typeof LatticeFixedRewardStakingFixtureUtils.deployContract.getDefaultResolvedParams
    >
  >;

  const deployContract = async () => {
    resolvedParams =
      await LatticeFixedRewardStakingFixtureUtils.deployContract.getDefaultResolvedParams();

    stakingContract =
      await LatticeFixedRewardStakingFixtureUtils.deployContract(
        resolvedParams
      );
  };

  before(async () => {
    await reset();
  });

  beforeEach(async () => {
    await loadFixture(deployContract);
  });

  it('Sets correct staking/reward token', async () => {
    await expect(stakingContract.stakingToken()).to.eventually.equal(
      resolvedParams.stakingToken.address
    );

    await expect(stakingContract.rewardToken()).to.eventually.equal(
      resolvedParams.rewardToken.address
    );
  });

  it('Sets correct staking restrictions', async () => {
    const stakingTokenDecimals = await resolvedParams.stakingToken.decimals();
    const rewardTokenDecimals = await resolvedParams.rewardToken.decimals();

    await expect(stakingContract.minStakingAmount()).to.eventually.equal(
      resolvedParams.minStakingAmount
        .times(Decimal.pow(10, stakingTokenDecimals))
        .toFixed()
    );

    await expect(stakingContract.minRewardAmount()).to.eventually.equal(
      resolvedParams.minRewardAmount
        .times(Decimal.pow(10, rewardTokenDecimals))
        .toFixed()
    );
  });

  it('Sets correct program rewards period', async () => {
    await expect(stakingContract.programStartsAt()).to.eventually.equal(
      resolvedParams.programStartsAt.unix()
    );

    await expect(
      stakingContract.programRewardsDepletionAt()
    ).to.eventually.equal(resolvedParams.programDepletionDateAt.unix());

    await expect(
      stakingContract.programLastAccruedRewardsAt()
    ).to.eventually.equal(resolvedParams.programStartsAt.unix());
  });

  it('Sets correct program rewards tax', async () => {
    await expect(stakingContract.taxRatioNumerator()).to.eventually.equal(
      resolvedParams.taxRatioNumerator.toFixed()
    );

    await expect(stakingContract.taxRatioDenominator()).to.eventually.equal(
      resolvedParams.taxRatioDenominator.toFixed()
    );
  });

  it('Grants correct roles', async () => {
    await expect(
      stakingContract.hasRole(
        LatticeFixedRewardStakingFixtureUtils.CONFIGURATION_ROLE_HASH,
        (
          await getOwnerAccount()
        ).address
      )
    ).to.eventually.be.true;

    await expect(
      stakingContract.hasRole(
        LatticeFixedRewardStakingFixtureUtils.CONFIGURATION_ROLE_HASH,
        (
          await getNamedAccount('steward-role')
        ).address
      )
    ).to.eventually.be.false;

    await expect(
      stakingContract.hasRole(
        LatticeFixedRewardStakingFixtureUtils.STEWARD_ROLE_HASH,
        (
          await getNamedAccount('steward-role')
        ).address
      )
    ).to.eventually.be.true;
  });

  describe('Reverts', () => {
    let params: Awaited<
      ReturnType<
        typeof LatticeFixedRewardStakingFixtureUtils.deployContract.getDefaultResolvedParams
      >
    >;

    let contractFactory: LatticeFixedRewardStaking__factory;
    let stakingTokenDecimals: number;
    let rewardTokenDecimals: number;

    let estimatedNormalGas: BigNumber;

    beforeEach(async () => {
      params =
        await LatticeFixedRewardStakingFixtureUtils.deployContract.getDefaultResolvedParams();

      contractFactory = await ethers.getContractFactory(
        'LatticeFixedRewardStaking'
      );

      stakingTokenDecimals = await params.stakingToken.decimals();
      rewardTokenDecimals = await params.rewardToken.decimals();

      estimatedNormalGas = await (
        await getOwnerAccount()
      ).estimateGas(
        contractFactory
          .connect(params.caller)
          .getDeployTransaction(
            resolvedParams.stakingToken.address,
            resolvedParams.minStakingAmount
              .times(Decimal.pow(10, stakingTokenDecimals))
              .toFixed(),
            resolvedParams.rewardToken.address,
            resolvedParams.minRewardAmount
              .times(Decimal.pow(10, rewardTokenDecimals))
              .toFixed(),
            resolvedParams.programStartsAt.unix(),
            resolvedParams.programDepletionDateAt.unix(),
            resolvedParams.taxRatioNumerator.toFixed(),
            resolvedParams.taxRatioDenominator.toFixed(),
            [resolvedParams.manager.address]
          )
      );
    });

    it('On bad program timeline', async () => {
      const contractDeployTrx = contractFactory
        .connect(params.caller)
        .getDeployTransaction(
          params.stakingToken.address,
          params.minStakingAmount
            .times(Decimal.pow(10, stakingTokenDecimals))
            .toFixed(),
          params.rewardToken.address,
          params.minRewardAmount
            .times(Decimal.pow(10, rewardTokenDecimals))
            .toFixed(),
          params.programDepletionDateAt.unix(),
          params.programStartsAt.unix(),
          params.taxRatioNumerator.toFixed(),
          params.taxRatioDenominator.toFixed(),
          [params.manager.address]
        );

      contractDeployTrx.gasLimit = estimatedNormalGas;

      const trx = (await getOwnerAccount()).sendTransaction(contractDeployTrx);

      await expect(trx).to.be.revertedWith('Invalid program timeline');
    });

    it('On bad staking token', async () => {
      const contractDeployTrx = contractFactory
        .connect(params.caller)
        .getDeployTransaction(
          '0x0000000000000000000000000000000000000000',
          params.minStakingAmount
            .times(Decimal.pow(10, stakingTokenDecimals))
            .toFixed(),
          params.rewardToken.address,
          params.minRewardAmount
            .times(Decimal.pow(10, rewardTokenDecimals))
            .toFixed(),
          params.programStartsAt.unix(),
          params.programDepletionDateAt.unix(),
          params.taxRatioNumerator.toFixed(),
          params.taxRatioDenominator.toFixed(),
          [params.manager.address]
        );

      contractDeployTrx.gasLimit = estimatedNormalGas;

      const trx = (await getOwnerAccount()).sendTransaction(contractDeployTrx);

      await expect(trx).to.be.revertedWith('Invalid staking token');
    });

    it('On bad reward token', async () => {
      const contractDeployTrx = contractFactory
        .connect(params.caller)
        .getDeployTransaction(
          params.stakingToken.address,
          params.minStakingAmount
            .times(Decimal.pow(10, stakingTokenDecimals))
            .toFixed(),
          '0x0000000000000000000000000000000000000000',
          params.minRewardAmount
            .times(Decimal.pow(10, rewardTokenDecimals))
            .toFixed(),
          params.programStartsAt.unix(),
          params.programDepletionDateAt.unix(),
          params.taxRatioNumerator.toFixed(),
          params.taxRatioDenominator.toFixed(),
          [params.manager.address]
        );

      contractDeployTrx.gasLimit = estimatedNormalGas;

      const trx = (await getOwnerAccount()).sendTransaction(contractDeployTrx);

      await expect(trx).to.be.revertedWith('Invalid reward token');
    });

    it('On bad tax ratio', async () => {
      const contractDeployTrx = contractFactory
        .connect(params.caller)
        .getDeployTransaction(
          params.stakingToken.address,
          params.minStakingAmount
            .times(Decimal.pow(10, stakingTokenDecimals))
            .toFixed(),
          params.rewardToken.address,
          params.minRewardAmount
            .times(Decimal.pow(10, rewardTokenDecimals))
            .toFixed(),
          params.programStartsAt.unix(),
          params.programDepletionDateAt.unix(),
          '20',
          '100',
          [params.manager.address]
        );

      contractDeployTrx.gasLimit = estimatedNormalGas;

      const trx = (await getOwnerAccount()).sendTransaction(contractDeployTrx);

      await expect(trx).to.be.revertedWith('Tax ratio exceeds 10% cap');
    });
  });
});
