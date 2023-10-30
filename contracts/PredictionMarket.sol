// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/utils/Context.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title Prediction Market Contract
 * @dev This contract allows users to stake ETH on a binary outcome event. Users can predict an outcome before the event starts, 
 * claim rewards if they predicted correctly after the event ends, and withdraw their stake if the event is expired without an outcome.
 */
contract PredictionMarket is Ownable, ReentrancyGuard {
    
    // The name of the prediction market, e.g., "Will it rain tomorrow?"
    string public marketName; 
    // Timestamp for when predictions start
    uint256 public startTime; 
    // Timestamp for when predictions end
    uint256 public endTime; 
    // Timestamp for when prediction market expires and users can withdraw their stake without an outcome
    uint256 public expiryTime; 

    // Struct to hold staking information
    struct StakeInfo {
        uint256 totalSupply;
        uint256 rewardPerTokenStored;
        uint256 lastUpdateTime;
        mapping(address => uint256) balances;
        mapping(address => uint256) userRewardPerTokenPaid;
        mapping(address => uint256) rewards;
    }

    // Mapping to hold staking parameters for correct (true) and incorrect (false) predictions
    mapping(bool => StakeInfo) private stakes;

    // Answer of the prediction market: 1 for correct, 2 for incorrect, 0 for unanswered
    uint8 private answer; 

    // Events to log the actions performed
    event Predicted(address indexed user, bool prediction, uint256 amount);
    event Claimed(address indexed user, uint256 reward);
    event WithdrawnExpiredStake(address indexed user, uint256 amount);

    /**
     * @dev Initializes the contract by setting the market parameters and transferring ownership.
     * @param _owner Address of the market owner.
     * @param _marketName Name of the prediction market.
     * @param _startTime Timestamp for when predictions can start being placed.
     * @param _endTime Timestamp for when predictions can no longer be placed.
     * @param _expiryTime Timestamp after which no claims can be made.
     */
    constructor(
        address _owner,
        string memory _marketName,
        uint256 _startTime,
        uint256 _endTime,
        uint256 _expiryTime
    ) Ownable(_owner) {
        require(_owner != address(0), "Owner cannot be the zero address");
        require(_startTime > block.timestamp, "Start time must be in the future");
        require(_startTime < _endTime, "Start time must be before end time");
        require(_endTime < _expiryTime, "End time must be before expiry time");

        marketName = _marketName;
        startTime = _startTime;
        endTime = _endTime;
        expiryTime = _expiryTime;
    }

    /* ========== MODIFIERS ========== */

    /**
     * @dev Modifier to update the reward for a user when staking or claiming.
     * @param account Address of the user.
     * @param _prediction The user's prediction (true for correct, false for incorrect).
     */
    modifier updateReward(address account, bool _prediction) {
        StakeInfo storage stake = stakes[_prediction];
        stake.rewardPerTokenStored = rewardPerToken(_prediction);
        stake.lastUpdateTime = lastTimeRewardApplicable();
        
        if (account != address(0)) {
            stake.rewards[account] = earned(account, _prediction);
            stake.userRewardPerTokenPaid[account] = stake.rewardPerTokenStored;
        }
        _;
    }

    /* ========== MUTATIVE FUNCTIONS ========== */

    /**
     * @dev Allows a user to stake ETH on a prediction.
     * @param _prediction The user's prediction (true for correct, false for incorrect).
     */
    function predict(bool _prediction) external payable updateReward(_msgSender(), _prediction) {
        require(block.timestamp >= startTime && block.timestamp < endTime, "Prediction window is closed");
        require(msg.value > 0, "Must send ETH to predict");

        StakeInfo storage stake = stakes[_prediction];
        stake.totalSupply += msg.value;
        stake.balances[_msgSender()] += msg.value;

        emit Predicted(_msgSender(), _prediction, msg.value);
    }

    /**
     * @dev Allows a user to claim their reward if they predicted correctly.
     */
    function claim() external nonReentrant updateReward(_msgSender(), correctPrediction()) {
        bool correct = correctPrediction();
        StakeInfo storage stake = stakes[correct];
        uint256 reward = stake.rewards[_msgSender()];
        
        require(block.timestamp >= endTime, "Cannot claim before end time");
        require(reward > 0, "Nothing to claim");

        // Calculate the reward based on the staked amount and opposite total supply
        uint256 rewardRate = stakes[!correct].totalSupply / (endTime - startTime);
        uint256 amount = stake.balances[_msgSender()] + reward * rewardRate;

        stake.rewards[_msgSender()] = 0;
        stake.balances[_msgSender()] = 0;

        Address.sendValue(payable(_msgSender()), amount);

        emit Claimed(_msgSender(), amount);
    }

    /**
     * @dev Allows a user to withdraw their stake if the prediction market is expired without an outcome being set.
     */
    function withdrawExpired() external nonReentrant {
        require(block.timestamp >= expiryTime, "Cannot withdraw before expiry time");
        require(answer == 0, "Outcome has been set");

        uint256 amountTruePrediction = stakes[true].balances[_msgSender()];
        uint256 amountFalsePrediction = stakes[false].balances[_msgSender()];
        uint256 totalAmount = amountTruePrediction + amountFalsePrediction;

        stakes[true].balances[_msgSender()] = 0;
        stakes[false].balances[_msgSender()] = 0;

        Address.sendValue(payable(_msgSender()), totalAmount);

        emit WithdrawnExpiredStake(_msgSender(), totalAmount);
    }

    /* ========== VIEWS ========== */

    /**
     * @dev Returns the balance staked by a user for a given prediction.
     * @param account Address of the user.
     * @param _prediction The user's prediction (true for correct, false for incorrect).
     */
    function balanceOf(address account, bool _prediction) external view returns (uint256) {
        return stakes[_prediction].balances[account];
    }

    /**
     * @dev Returns the total supply staked for a given prediction.
     * @param _prediction The prediction (true for correct, false for incorrect).
     */
    function totalSupply(bool _prediction) external view returns (uint256) {
        return stakes[_prediction].totalSupply;
    }

    /**
     * @dev Returns the last applicable timestamp for rewards calculation.
     */
    function lastTimeRewardApplicable() public view returns (uint256) {
        return block.timestamp < endTime ? block.timestamp : endTime;
    }

    /**
     * @dev Calculates the reward per token staked for a given prediction.
     * @param _prediction The prediction (true for correct, false for incorrect).
     */
    function rewardPerToken(bool _prediction) public view returns (uint256) {
        StakeInfo storage stake = stakes[_prediction];
        if (stake.totalSupply == 0) {
            return stake.rewardPerTokenStored;
        }
        return 
            stake.rewardPerTokenStored +
            (((lastTimeRewardApplicable() - stake.lastUpdateTime) * 1e18) / stake.totalSupply);
    }

    /**
     * @dev Calculates the amount of rewards earned by a user for a given prediction.
     * @param account Address of the user.
     * @param _prediction The user's prediction (true for correct, false for incorrect).
     */
    function earned(address account, bool _prediction) public view returns (uint256) {
        StakeInfo storage stake = stakes[_prediction];
        return 
            ((stake.balances[account] * (rewardPerToken(_prediction) - stake.userRewardPerTokenPaid[account])) / 1e18) 
            + stake.rewards[account];
    }

    /* ========== RESTRICTED FUNCTIONS ========== */

    /**
     * @dev Sets the outcome of the prediction market.
     * @param _outcome The outcome of the prediction market (1 for correct, 2 for incorrect).
     */
    function setOutcome(bool _outcome) external onlyOwner {
        require(block.timestamp >= endTime, "Cannot set answer before end time");
        require(block.timestamp < expiryTime, "Cannot set answer after expiry time");
        require(answer == 0, "Answer already set");

        answer = _outcome ? 1 : 2;
    }

    /* ========== HELPER FUNCTIONS ========== */

    /**
     * @dev Returns true if the stored answer matches the prediction made.
     */
    function correctPrediction() private view returns (bool) {
        require(answer != 0, "Outcome has not been set yet");
        return (answer == 1);
    }
}

