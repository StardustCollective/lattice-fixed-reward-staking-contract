import { Dayjs } from 'dayjs';
import Decimal from 'decimal.js';

type StakingContractConfiguration = {
  stakingTokenDecimals: number;
  minStakingAmount: Decimal;
  rewardTokenDecimals: number;
  minRewardAmount: Decimal;
  programRewardAmount: Decimal;
  programStartsAt: Dayjs;
  programEndsAt: Dayjs;
  taxRatioNumerator: Decimal;
  taxRatioDenominator: Decimal;
};

export { StakingContractConfiguration };
