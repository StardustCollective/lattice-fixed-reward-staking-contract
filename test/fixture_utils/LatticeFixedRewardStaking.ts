import dayjs from 'dayjs';
import Decimal from 'decimal.js';
import { ethers } from 'hardhat';

import { getNamedAccount, getOwnerAccount, waitForTransaction } from '../utils';

import { createFixtureUtil } from './meta';
import { TestTokenFixtureUtils } from './TestToken';

const CONFIGURATION_ROLE_HASH = ethers.utils.keccak256(
  ethers.utils.toUtf8Bytes('CONFIGURATION_ROLE')
);
const STEWARD_ROLE_HASH = ethers.utils.keccak256(
  ethers.utils.toUtf8Bytes('STEWARD_ROLE')
);

const deployContract = createFixtureUtil(
  () => ({
    stakingToken: TestTokenFixtureUtils.deployContract({
      tokenDecimals: 18
    }),
    rewardToken: TestTokenFixtureUtils.deployContract({
      tokenDecimals: 8
    }),
    minStakingAmount: new Decimal('100'),
    minRewardAmount: new Decimal('10'),
    programRewardAmount: new Decimal('30000'),
    programStartsAt: dayjs().startOf('day').add(3, 'days'),
    programDepletionDateAt: dayjs().startOf('day').add(33, 'days'),
    taxRatioNumerator: new Decimal('35'),
    taxRatioDenominator: new Decimal('1000'),
    caller: getOwnerAccount(),
    manager: getNamedAccount('steward-role')
  }),
  async (params) => {
    const contractFactory = await ethers.getContractFactory(
      'LatticeFixedRewardStaking'
    );

    const stakingTokenDecimals = await params.stakingToken.decimals();
    const rewardTokenDecimals = await params.rewardToken.decimals();

    const contract = await contractFactory
      .connect(params.caller)
      .deploy(
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
        params.taxRatioNumerator.toFixed(),
        params.taxRatioDenominator.toFixed(),
        [params.manager.address]
      );

    await contract.deployed();

    return contract;
  }
);

const mintRewards = createFixtureUtil(
  () => ({
    stakingContract: deployContract(),
    rewardAmount: new Decimal('30000'),
    minter: getOwnerAccount(),
    receiver: getOwnerAccount()
  }),
  async (params) => {
    const rewardToken = await ethers.getContractAt(
      'TestToken',
      await params.stakingContract.rewardToken(),
      await getOwnerAccount()
    );

    const rewardTokenDecimals = await rewardToken.decimals();

    await TestTokenFixtureUtils.mintAndApproveTokens({
      contract: rewardToken,
      minter: params.minter,
      receiver: params.receiver,
      spender: params.stakingContract,
      amount: params.rewardAmount
    });

    await waitForTransaction(
      params.stakingContract.depositProgramRewards(
        params.rewardAmount
          .times(Decimal.pow(10, rewardTokenDecimals))
          .toFixed()
      )
    );
  }
);

const stakeUser = createFixtureUtil(
  () => ({
    stakingContract: deployContract(),
    stakingAmount: new Decimal('1000'),
    stakingAccount: getNamedAccount('user-a'),
    minter: getOwnerAccount(),
    claimExistingRewards: false
  }),
  async (params) => {
    const stakingToken = await ethers.getContractAt(
      'TestToken',
      await params.stakingContract.stakingToken(),
      await getOwnerAccount()
    );

    const stakingTokenDecimals = await stakingToken.decimals();

    await TestTokenFixtureUtils.mintAndApproveTokens({
      contract: stakingToken,
      minter: params.minter,
      receiver: params.stakingAccount,
      spender: params.stakingContract,
      amount: params.stakingAmount
    });

    await waitForTransaction(
      params.stakingContract
        .connect(params.stakingAccount)
        .stake(
          params.stakingAmount
            .times(Decimal.pow(10, stakingTokenDecimals))
            .toFixed(),
          params.claimExistingRewards
        )
    );
  }
);

const LatticeFixedRewardStakingFixtureUtils = {
  deployContract,
  mintRewards,
  stakeUser,
  CONFIGURATION_ROLE_HASH,
  STEWARD_ROLE_HASH
};

export { LatticeFixedRewardStakingFixtureUtils };
