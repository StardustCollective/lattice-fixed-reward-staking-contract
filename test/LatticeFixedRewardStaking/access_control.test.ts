import { loadFixture, reset } from '@nomicfoundation/hardhat-network-helpers';
import { expect } from 'chai';

import { LatticeFixedRewardStaking } from '../../typechain-types';
import { LatticeFixedRewardStakingFixtureUtils } from '../fixture_utils';
import { getNamedAccount, NamedAccount, waitForTransaction } from '../utils';

describe('LatticeFixedRewardsStaking :: Access Control', () => {
  let stakingContract: LatticeFixedRewardStaking;

  const deployContract = async () => {
    stakingContract =
      await LatticeFixedRewardStakingFixtureUtils.deployContract();

    const ownerAccount = await getNamedAccount('owner');
    const configurationAccount = await getNamedAccount('configuration-role');

    await waitForTransaction(
      stakingContract
        .connect(ownerAccount)
        .grantRole(
          LatticeFixedRewardStakingFixtureUtils.CONFIGURATION_ROLE_HASH,
          configurationAccount.address
        )
    );
  };

  before(async () => {
    await reset();
  });

  beforeEach(async () => {
    await loadFixture(deployContract);
  });

  it('Initializes correct configuration role', async () => {
    await expect(stakingContract.CONFIGURATION_ROLE()).to.eventually.equal(
      LatticeFixedRewardStakingFixtureUtils.CONFIGURATION_ROLE_HASH
    );
  });

  it('Initializes correct steward role', async () => {
    await expect(stakingContract.STEWARD_ROLE()).to.eventually.equal(
      LatticeFixedRewardStakingFixtureUtils.STEWARD_ROLE_HASH
    );
  });

  describe('Access to methods', () => {
    const executeHasAccessToMethods = (
      account: NamedAccount,
      allow: string[],
      deny: string[]
    ) => {
      const getMethodMockArgs = (name: string) => {
        const methodFragment = stakingContract.interface.getFunction(
          name as any
        );

        const args: any[] = [];

        for (const inputParam of methodFragment.inputs) {
          const arg = inputParam.baseType.match(/int/g)
            ? '0'
            : inputParam.baseType.match(/address/g)
            ? '0x0000000000000000000000000000000000000000'
            : null;

          args.push(arg);
        }

        return args;
      };

      for (const allowed of allow) {
        it(`Is allowed to execute ${allowed}()`, async () => {
          await expect(
            (
              stakingContract.connect(await getNamedAccount(account)).functions[
                allowed as keyof typeof stakingContract.functions
              ] as (...args: any[]) => Promise<any>
            )(...getMethodMockArgs(allowed))
          ).to.not.be.revertedWith(
            /AccessControl: account \w+ is missing role/g
          );
        });
      }

      for (const denied of deny) {
        it(`Is denied to execute ${denied}()`, async () => {
          await expect(
            (
              stakingContract.connect(await getNamedAccount(account)).functions[
                denied as keyof typeof stakingContract.functions
              ] as (...args: any[]) => Promise<any>
            )(...getMethodMockArgs(denied))
          ).to.be.revertedWith(/AccessControl: account \w+ is missing role/g);
        });
      }
    };

    describe('Steward Role', () => {
      executeHasAccessToMethods(
        'steward-role',
        [
          'accrueRewardsPeriod',
          'depositProgramRewards',
          'withdrawProgramRewards',
          'withdrawProgramLostRewards',
          'updateProgramDepletionDate',
          'updateProgramRestriction',
          'recoverERC20',
          'pause',
          'unpause'
        ],
        ['withdrawProgramTaxes', 'updateProgramTax']
      );
    });

    describe('Configuration Role', () => {
      executeHasAccessToMethods(
        'configuration-role',
        ['withdrawProgramTaxes', 'updateProgramTax'],
        [
          'accrueRewardsPeriod',
          'depositProgramRewards',
          'withdrawProgramRewards',
          'withdrawProgramLostRewards',
          'updateProgramDepletionDate',
          'updateProgramRestriction',
          'recoverERC20',
          'pause',
          'unpause'
        ]
      );
    });
  });
});
