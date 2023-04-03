// SPDX-License-Identifier: MIT
/**
 * @title Lattice LP Fixed Reward Staking Contract
 * @author Stardust Collective <info@stardustcollective.org>
 *
 * Transformed idea from SushiSwap's https://github.com/sushiswap/StakingContract
 */
pragma solidity ^0.8.18;

import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {ReentrancyGuard} from "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import {Pausable} from "@openzeppelin/contracts/security/Pausable.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract LatticeLpStaking is ReentrancyGuard, Pausable, Ownable {
    using SafeERC20 for IERC20;

    uint256 constant MAGNITUDE_CONSTANT = 1e40;

    IERC20 stakingToken;
    uint256 stakingTokenBalance;
    uint256 minStakingAmount;

    IERC20 rewardToken;
    uint256 rewardTokenBalance;
    uint256 minRewardAmount;

    uint256 programStartsAt;
    uint256 programEndsAt;
    uint256 programRewardRemaining;
    uint256 programRewardPerLiquidity;
    uint256 programLastAccruedRewardsAt;

    uint256 taxRatioNumerator;
    uint256 taxRatioDenominator;
    uint256 taxAccumulated;

    struct StakingUser {
        uint256 amountStaked;
        uint256 lastProgramRewardPerLiquidity;
    }

    mapping(address => StakingUser) users;

    constructor(
        address _stakingToken,
        uint256 _minStakingAmount,
        address _rewardToken,
        uint256 _minRewardAmount,
        int256 _nextRewardAmountChange,
        uint256 _programStartsAt,
        uint256 _programEndsAt,
        uint256 _taxRatioNumerator,
        uint256 _taxRatioDenominator
    ) {
        _configureProgramTimeline(_programStartsAt, _programEndsAt, false);
        _configureProgramCondition(
            _stakingToken,
            _minStakingAmount,
            _rewardToken,
            _minRewardAmount,
            _nextRewardAmountChange,
            false
        );
        configureProgramTax(_taxRatioNumerator, _taxRatioDenominator);
    }

    function configureProgramCondition(
        address _stakingToken,
        uint256 _minStakingAmount,
        address _rewardToken,
        uint256 _minRewardAmount,
        int256 _nextRewardAmountChange
    ) public onlyOwner nonReentrant {
        _configureProgramCondition(
            _stakingToken,
            _minStakingAmount,
            _rewardToken,
            _minRewardAmount,
            _nextRewardAmountChange,
            true
        );
    }

    function configureProgramTimeline(
        uint256 _programStartsAt,
        uint256 _programEndsAt
    ) public onlyOwner {
        _configureProgramTimeline(_programStartsAt, _programEndsAt, true);
    }

    function configureProgramTax(
        uint256 _taxRatioNumerator,
        uint256 _taxRatioDenominator
    ) public onlyOwner {
        taxRatioNumerator = _taxRatioNumerator;
        taxRatioDenominator = _taxRatioDenominator;
    }

    function stake(
        uint256 _amount,
        bool _claimExistingRewards
    ) external nonReentrant {
        _stake(_amount, _claimExistingRewards);
    }

    function withdraw(
        uint256 _amount,
        bool _claimExistingRewards
    ) external nonReentrant {
        _withdraw(_amount, _claimExistingRewards);
    }

    function claimRewards() external nonReentrant {
        // We generate a new rewards period to include immediately previous rewards for the user
        _accrueRewardsPeriod();
        _claimRewards();
    }

    /**
     * Calculate a new rewards period for the current time, and calculate rewards based
     * on the next program reward per liquidity.
     */
    function availableRewards()
        external
        view
        returns (uint256 _userRewardsTaxed, uint256 _userTaxes)
    {
        uint256 _programNextAccruedRewardsAt = _min(
            block.timestamp,
            programEndsAt
        );

        uint256 _rewardRemainingDuration = programEndsAt -
            programLastAccruedRewardsAt;

        uint256 _rewardPeriodDuration = _programNextAccruedRewardsAt -
            programLastAccruedRewardsAt;

        uint256 _rewardAmountForPeriod = (programRewardRemaining *
            _rewardPeriodDuration) / _rewardRemainingDuration;

        uint256 _nextProgramRewardPerLiquidity = programRewardPerLiquidity;

        // Use actual RPL if the program has ended or staked liquidity == 0
        if (
            _programNextAccruedRewardsAt < programEndsAt &&
            stakingTokenBalance > 0
        ) {
            _nextProgramRewardPerLiquidity +=
                (_rewardAmountForPeriod * MAGNITUDE_CONSTANT) /
                stakingTokenBalance;
        }

        (_userRewardsTaxed, _userTaxes) = _calculateRewardsAndTaxes(
            users[_msgSender()].lastProgramRewardPerLiquidity,
            users[_msgSender()].amountStaked,
            _nextProgramRewardPerLiquidity,
            taxRatioNumerator,
            taxRatioDenominator
        );
    }

    function _configureProgramCondition(
        address _stakingToken,
        uint256 _minStakingAmount,
        address _rewardToken,
        uint256 _minRewardAmount,
        int256 _nextRewardAmountChange,
        bool _accrueRewards
    ) internal {
        require(
            block.timestamp < programEndsAt,
            "Unable to configure program condition for finished program"
        );

        if (_accrueRewards) {
            _accrueRewardsPeriod();
        }

        stakingToken = IERC20(_stakingToken);
        minStakingAmount = _minStakingAmount;
        rewardToken = IERC20(_rewardToken);
        minRewardAmount = _minRewardAmount;

        if (_nextRewardAmountChange > 0) {
            uint256 _rewardAmountToTransfer = uint256(_nextRewardAmountChange);

            rewardToken.safeTransferFrom(
                _msgSender(),
                address(this),
                _rewardAmountToTransfer
            );

            rewardTokenBalance += _rewardAmountToTransfer;
            programRewardRemaining += _rewardAmountToTransfer;
        } else if (_nextRewardAmountChange < 0) {
            uint256 _rewardAmountToTransfer = uint256(
                _nextRewardAmountChange * -1
            );

            require(
                _rewardAmountToTransfer <= rewardTokenBalance,
                "Reward change is greater than available"
            );

            rewardToken.safeTransferFrom(
                address(this),
                _msgSender(),
                _rewardAmountToTransfer
            );

            rewardTokenBalance -= _rewardAmountToTransfer;
            programRewardRemaining -= _rewardAmountToTransfer;
        }
    }

    function _configureProgramTimeline(
        uint256 _programStartsAt,
        uint256 _programEndsAt,
        bool _accrueRewards
    ) internal {
        uint256 _rewardAmountForPeriod;
        uint256 _programRewardPerLiquidityChange;

        if (_accrueRewards) {
            (
                _rewardAmountForPeriod,
                _programRewardPerLiquidityChange
            ) = _accrueRewardsPeriod();
        }

        if (_programStartsAt != 0) {
            programStartsAt = _programStartsAt;

            if (_accrueRewards) {
                /**
                 * @todo
                 * change program start date without loss of rewards by unused time
                 */
            }
        }

        if (_programEndsAt != 0) {
            programEndsAt = _programEndsAt;
            programLastAccruedRewardsAt = _programStartsAt;
        }
    }

    function _stake(uint256 _amount, bool _claimExistingRewards) internal {
        require(
            block.timestamp >= programStartsAt,
            "Staking program not open yet"
        );
        require(block.timestamp < programEndsAt, "Staking program has closed");
        require(
            _amount + users[_msgSender()].amountStaked > minStakingAmount,
            "Staking less than required by the specified program"
        );

        stakingToken.safeTransferFrom(_msgSender(), address(this), _amount);

        // Generate a new rewards period => new program reward per liquidity
        _accrueRewardsPeriod();

        uint256 _userNextAmountStaked = users[_msgSender()].amountStaked +
            _amount;

        if (_claimExistingRewards) {
            _claimRewards();
        } else {
            _saveRewards(_userNextAmountStaked);
        }

        users[_msgSender()].amountStaked = _userNextAmountStaked;
        users[_msgSender()]
            .lastProgramRewardPerLiquidity = programRewardPerLiquidity;
        stakingTokenBalance += _amount;
    }

    function _withdraw(uint256 _amount, bool _claimExistingRewards) internal {
        require(users[_msgSender()].amountStaked == 0, "No amount to withdraw");
        require(
            users[_msgSender()].amountStaked >= _amount,
            "Amount to withdraw is greater than staked"
        );

        // Generate a new rewards period => new program reward per liquidity
        _accrueRewardsPeriod();

        uint256 _userNextAmountStaked = users[_msgSender()].amountStaked -
            _amount;

        if (_claimExistingRewards || _userNextAmountStaked == 0) {
            _claimRewards();
        } else {
            _saveRewards(_userNextAmountStaked);
        }

        users[_msgSender()].amountStaked = _userNextAmountStaked;
        stakingTokenBalance -= _amount;

        stakingToken.safeTransferFrom(address(this), _msgSender(), _amount);
    }

    function _claimRewards() internal {
        (
            uint256 _userRewardsTaxed,
            uint256 _userTaxes
        ) = _calculateRewardsAndTaxes(
                users[_msgSender()].lastProgramRewardPerLiquidity,
                users[_msgSender()].amountStaked,
                programRewardPerLiquidity,
                taxRatioNumerator,
                taxRatioDenominator
            );

        require(
            _userRewardsTaxed >= minRewardAmount,
            "Not enough rewards to claim"
        );

        users[_msgSender()]
            .lastProgramRewardPerLiquidity = programRewardPerLiquidity;
        taxAccumulated += _userTaxes;
        rewardTokenBalance -= _userRewardsTaxed;

        rewardToken.safeTransferFrom(
            address(this),
            _msgSender(),
            _userRewardsTaxed
        );
    }

    /**
     * We derive a new [user].lastProgramRewardPerLiquidity based on the new amount
     * staked and considering previous rewards. The in the next call to _calculateRewardsAndTaxes()
     * user will receive both previous-non-claimed rewards and new rewards.
     */
    function _saveRewards(uint256 _nextAmountStaked) internal {
        (
            uint256 _userRewardsTaxed,
            uint256 _userTaxes
        ) = _calculateRewardsAndTaxes(
                users[_msgSender()].lastProgramRewardPerLiquidity,
                users[_msgSender()].amountStaked,
                programRewardPerLiquidity,
                taxRatioNumerator,
                taxRatioDenominator
            );

        uint256 _userRewards = _userRewardsTaxed + _userTaxes;

        uint256 _userProgramRewardPerLiquidityDelta = (_userRewards *
            MAGNITUDE_CONSTANT) / _nextAmountStaked;

        users[_msgSender()].lastProgramRewardPerLiquidity =
            programRewardPerLiquidity -
            _userProgramRewardPerLiquidityDelta;
    }

    /**
     * Generate a new rewards period, discard unused/reserved reward amount for the generated period
     * add reward per liquidity for the generated period in order to claim/calculate rewards.
     */
    function _accrueRewardsPeriod()
        internal
        returns (
            uint256 _rewardAmountForPeriod,
            uint256 _programRewardPerLiquidityChange
        )
    {
        uint256 _programNextAccruedRewardsAt = _min(
            block.timestamp,
            programEndsAt
        );

        // Freeze program reward per liquidity after the program ends
        if (_programNextAccruedRewardsAt >= programEndsAt) {
            return (0, 0);
        }

        uint256 _rewardRemainingDuration = programEndsAt -
            programLastAccruedRewardsAt;

        uint256 _rewardPeriodDuration = _programNextAccruedRewardsAt -
            programLastAccruedRewardsAt;

        _rewardAmountForPeriod =
            (programRewardRemaining * _rewardPeriodDuration) /
            _rewardRemainingDuration;

        _programRewardPerLiquidityChange = 0;

        if (stakingTokenBalance > 0) {
            _programRewardPerLiquidityChange =
                (_rewardAmountForPeriod * MAGNITUDE_CONSTANT) /
                stakingTokenBalance;
            programRewardPerLiquidity += _programRewardPerLiquidityChange;
        }

        programRewardRemaining -= _rewardAmountForPeriod;

        programLastAccruedRewardsAt = _programNextAccruedRewardsAt;
    }

    function _calculateRewardsAndTaxes(
        uint256 _userLastProgramRewardPerLiquidity,
        uint256 _userAmountStaked,
        uint256 _programRewardPerLiquidity,
        uint256 _taxRatioNumerator,
        uint256 _taxRatioDenominator
    ) internal pure returns (uint256 _userRewardsTaxed, uint256 _userTaxes) {
        uint256 _userProgramRewardPerLiquidityDelta = _programRewardPerLiquidity -
                _userLastProgramRewardPerLiquidity;

        uint256 _userRewards = (_userProgramRewardPerLiquidityDelta *
            _userAmountStaked) / MAGNITUDE_CONSTANT;

        _userTaxes = (_userRewards * _taxRatioNumerator) / _taxRatioDenominator;

        _userRewardsTaxed = _userRewards - _userRewardsTaxed;
    }

    function _max(uint256 a, uint256 b) internal pure returns (uint256) {
        return a > b ? a : b;
    }

    function _min(uint256 a, uint256 b) internal pure returns (uint256) {
        return a < b ? a : b;
    }
}
