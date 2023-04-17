// SPDX-License-Identifier: MIT
/**
 * @title Lattice Fixed Reward Staking Contract
 * @author Stardust Collective <info@stardustcollective.org>
 *
 * Transformed idea from SushiSwap's https://github.com/sushiswap/StakingContract
 */
pragma solidity ^0.8.18;

import {SafeERC20} from '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import {IERC20} from '@openzeppelin/contracts/token/ERC20/IERC20.sol';

import {ReentrancyGuard} from '@openzeppelin/contracts/security/ReentrancyGuard.sol';
import {Pausable} from '@openzeppelin/contracts/security/Pausable.sol';
import {Ownable} from '@openzeppelin/contracts/access/Ownable.sol';
import {Math} from '@openzeppelin/contracts/utils/math/Math.sol';

contract LatticeFixedRewardStaking is ReentrancyGuard, Pausable, Ownable {
    using SafeERC20 for IERC20;

    uint256 public constant MAGNITUDE_CONSTANT = 1e40;

    IERC20 public stakingToken;
    uint256 public minStakingAmount;

    IERC20 public rewardToken;
    uint256 public minRewardAmount;

    uint256 public programStartsAt;
    uint256 public programEndsAt;
    uint256 public programStakedLiquidity;
    uint256 public programRewardLost;
    uint256 public programRewardLostWithdrawn;
    uint256 public programRewardRemaining;
    uint256 public programRewardPerLiquidity;
    uint256 public programLastAccruedRewardsAt;

    uint256 public taxRatioNumerator;
    uint256 public taxRatioDenominator;
    uint256 public taxAccumulated;
    uint256 public taxAccumulatedWithdrawn;

    struct StakingUser {
        uint256 amountStaked;
        uint256 lastProgramRewardPerLiquidity;
    }

    mapping(address => StakingUser) public users;

    event Staked(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);
    event RewardsClaimed(
        address indexed user,
        uint256 rewardsTaxed,
        uint256 taxes
    );

    event RewardsLost(uint256 amount);
    event RecoveredERC20(address indexed token, uint256 amount);

    constructor(
        address _stakingToken,
        uint256 _minStakingAmount,
        address _rewardToken,
        uint256 _minRewardAmount,
        uint256 _programStartsAt,
        uint256 _programEndsAt,
        uint256 _taxRatioNumerator,
        uint256 _taxRatioDenominator
    ) {
        require(_programStartsAt < _programEndsAt, 'Invalid program timeline');
        require(_stakingToken != address(0), 'Invalid staking token');
        require(_rewardToken != address(0), 'Invalid reward token');

        // Program Condition
        stakingToken = IERC20(_stakingToken);
        minStakingAmount = _minStakingAmount;
        rewardToken = IERC20(_rewardToken);
        minRewardAmount = _minRewardAmount;

        // Program Timeline
        programStartsAt = _programStartsAt;
        programEndsAt = _programEndsAt;
        programLastAccruedRewardsAt = _programStartsAt;

        // Program Taxes
        taxRatioNumerator = _taxRatioNumerator;
        taxRatioDenominator = _taxRatioDenominator;
    }

    /**
     * General Functions
     */

    function stake(
        uint256 _amount,
        bool _claimExistingRewards
    ) external nonReentrant whenNotPaused {
        _stake(_amount, _claimExistingRewards);
    }

    function withdraw(
        uint256 _amount,
        bool _claimExistingRewards,
        bool _waiveExistingRewards
    ) external nonReentrant whenNotPaused {
        _withdraw(_amount, _claimExistingRewards, _waiveExistingRewards);
    }

    function claimRewards() external nonReentrant whenNotPaused {
        // We generate a new rewards period to include immediately previous rewards for the user
        _accrueRewardsPeriod();
        _claimRewards(false);
    }

    /**
     * Calculate a new rewards period for the current time, and calculate rewards based
     * on the next program reward per liquidity.
     */
    function availableRewards(
        address user
    ) external view returns (uint256 _userRewardsTaxed, uint256 _userTaxes) {
        uint256 _programNextAccruedRewardsAt = Math.min(
            block.timestamp,
            programEndsAt
        );

        uint256 _rewardRemainingDuration = programEndsAt -
            programLastAccruedRewardsAt;

        uint256 _rewardPeriodDuration = _programNextAccruedRewardsAt -
            programLastAccruedRewardsAt;

        uint256 _rewardAmountForPeriod = Math.mulDiv(
            programRewardRemaining,
            _rewardPeriodDuration,
            _rewardRemainingDuration
        );

        uint256 _nextProgramRewardPerLiquidity = programRewardPerLiquidity;

        // Use actual RPL if the program has ended or staked liquidity == 0
        if (
            _programNextAccruedRewardsAt < programEndsAt &&
            programStakedLiquidity > 0
        ) {
            _nextProgramRewardPerLiquidity += Math.mulDiv(
                _rewardAmountForPeriod,
                MAGNITUDE_CONSTANT,
                programStakedLiquidity
            );
        }

        (_userRewardsTaxed, _userTaxes) = _calculateRewardsAndTaxes(
            users[user].lastProgramRewardPerLiquidity,
            users[user].amountStaked,
            _nextProgramRewardPerLiquidity,
            taxRatioNumerator,
            taxRatioDenominator
        );
    }

    /**
     * General Internal Functions
     */

    function _stake(uint256 _amount, bool _claimExistingRewards) internal {
        require(
            block.timestamp >= programStartsAt,
            'Staking program not open yet'
        );
        require(
            programRewardRemaining > 0,
            'There are no rewards deposited yet'
        );
        require(block.timestamp < programEndsAt, 'Staking program has closed');
        require(_amount > 0, 'Unable to stake 0 tokens');
        require(
            _amount + users[_msgSender()].amountStaked >= minStakingAmount,
            'Staking less than required by the specified program'
        );

        stakingToken.safeTransferFrom(_msgSender(), address(this), _amount);

        // Generate a new rewards period => new program reward per liquidity
        _accrueRewardsPeriod();

        uint256 _userNextAmountStaked = users[_msgSender()].amountStaked +
            _amount;

        if (_claimExistingRewards) {
            _claimRewards(false);
        } else {
            _saveRewards(_userNextAmountStaked);
        }

        users[_msgSender()].amountStaked = _userNextAmountStaked;
        users[_msgSender()]
            .lastProgramRewardPerLiquidity = programRewardPerLiquidity;
        programStakedLiquidity += _amount;

        emit Staked(_msgSender(), _amount);
    }

    function _withdraw(
        uint256 _amount,
        bool _claimExistingRewards,
        bool _waiveExistingRewards
    ) internal {
        require(users[_msgSender()].amountStaked != 0, 'No amount to withdraw');
        require(
            users[_msgSender()].amountStaked >= _amount,
            'Amount to withdraw is greater than staked'
        );
        require(_amount > 0, 'Unable to withdraw 0 tokens');
        require(
            users[_msgSender()].amountStaked == _amount ||
                users[_msgSender()].amountStaked - _amount >= minStakingAmount,
            'The final staked amount would be than required by the specified program'
        );

        // Generate a new rewards period => new program reward per liquidity
        _accrueRewardsPeriod();

        uint256 _userNextAmountStaked = users[_msgSender()].amountStaked -
            _amount;

        if (_claimExistingRewards || _userNextAmountStaked == 0) {
            _claimRewards(_waiveExistingRewards);
        } else {
            _saveRewards(_userNextAmountStaked);
        }

        users[_msgSender()].amountStaked = _userNextAmountStaked;
        programStakedLiquidity -= _amount;

        stakingToken.safeTransfer(_msgSender(), _amount);

        emit Withdrawn(_msgSender(), _amount);
    }

    function _claimRewards(bool _waiveExistingRewards) internal {
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
            _userRewardsTaxed >= minRewardAmount || _waiveExistingRewards,
            'Not enough rewards to claim'
        );

        users[_msgSender()]
            .lastProgramRewardPerLiquidity = programRewardPerLiquidity;

        if (_waiveExistingRewards) {
            programRewardLost += _userRewardsTaxed + _userTaxes;
            emit RewardsLost(_userRewardsTaxed + _userTaxes);
        } else {
            taxAccumulated += _userTaxes;
            rewardToken.safeTransfer(_msgSender(), _userRewardsTaxed);
            emit RewardsClaimed(_msgSender(), _userRewardsTaxed, _userTaxes);
        }
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

        uint256 _userProgramRewardPerLiquidityDelta = Math.mulDiv(
            _userRewards,
            MAGNITUDE_CONSTANT,
            _nextAmountStaked
        );

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
        uint256 _programNextAccruedRewardsAt = Math.min(
            block.timestamp,
            programEndsAt
        );

        uint256 _rewardRemainingDuration = programEndsAt -
            programLastAccruedRewardsAt;

        // Don't accrue if the remaining duration is 0 (program has ended)
        if (_rewardRemainingDuration == 0) {
            return (0, 0);
        }

        uint256 _rewardPeriodDuration = _programNextAccruedRewardsAt -
            programLastAccruedRewardsAt;

        _rewardAmountForPeriod = Math.mulDiv(
            programRewardRemaining,
            _rewardPeriodDuration,
            _rewardRemainingDuration
        );

        _programRewardPerLiquidityChange = 0;

        if (programStakedLiquidity > 0) {
            _programRewardPerLiquidityChange = Math.mulDiv(
                _rewardAmountForPeriod,
                MAGNITUDE_CONSTANT,
                programStakedLiquidity
            );
            programRewardPerLiquidity += _programRewardPerLiquidityChange;
        } else {
            programRewardLost += _rewardAmountForPeriod;
            emit RewardsLost(_rewardAmountForPeriod);
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

        uint256 _userRewards = Math.mulDiv(
            _userProgramRewardPerLiquidityDelta,
            _userAmountStaked,
            MAGNITUDE_CONSTANT
        );

        _userTaxes = Math.mulDiv(
            _userRewards,
            _taxRatioNumerator,
            _taxRatioDenominator
        );

        _userRewardsTaxed = _userRewards - _userTaxes;
    }

    /**
     * Admin Functions
     */

    function accrueRewardsPeriod() public onlyOwner {
        _accrueRewardsPeriod();
    }

    function depositProgramRewards(uint256 _amount) public onlyOwner {
        require(_amount > 0, 'Unable to deposit 0 reward tokens');
        rewardToken.safeTransferFrom(_msgSender(), address(this), _amount);
        programRewardRemaining += _amount;
    }

    function withdrawProgramRewards(uint256 _amount) public onlyOwner {
        require(_amount > 0, 'Unable to withdraw 0 reward tokens');
        require(
            _amount <= programRewardRemaining,
            'Unable to withdraw more than the program reward remaining'
        );
        programRewardRemaining -= _amount;
        rewardToken.safeTransferFrom(address(this), _msgSender(), _amount);
    }

    function withdrawProgramLostRewards(uint256 _amount) public onlyOwner {
        uint256 _lostRewardsAvailable = programRewardLost -
            programRewardLostWithdrawn;
        require(
            _amount <= _lostRewardsAvailable,
            'Amount is greated than available lost rewards'
        );
        programRewardLostWithdrawn += _amount;
        rewardToken.safeTransferFrom(address(this), _msgSender(), _amount);
    }

    function withdrawProgramTaxes(uint256 _amount) public onlyOwner {
        uint256 _taxesAvailable = taxAccumulated - taxAccumulatedWithdrawn;
        require(
            _amount <= _taxesAvailable,
            'Amount is greated than available taxes'
        );
        taxAccumulatedWithdrawn += _amount;
        rewardToken.safeTransferFrom(address(this), _msgSender(), _amount);
    }

    function recoverERC20(IERC20 token, uint256 amount) external onlyOwner {
        require(
            address(token) != address(stakingToken),
            'Cannot withdraw the staking token'
        );
        require(
            address(token) != address(rewardToken),
            'Cannot withdraw the reward token'
        );

        uint256 tokenBalance = token.balanceOf(address(this));
        require(tokenBalance >= amount, 'Not enough tokens to withdraw');

        token.safeTransfer(owner(), amount);

        emit RecoveredERC20(address(token), amount);
    }

    function updateProgramTax(
        uint256 _taxRatioNumerator,
        uint256 _taxRatioDenominator
    ) public onlyOwner {
        taxRatioNumerator = _taxRatioNumerator;
        taxRatioDenominator = _taxRatioDenominator;
    }

    function pause() public onlyOwner {
        _pause();
    }

    function unpause() public onlyOwner {
        _unpause();
    }
}
