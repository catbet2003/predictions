// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

import "hardhat/console.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Context.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract Prediction is Ownable, ReentrancyGuard {
    
    string public name; // e.g. "Ismail Haniyeh Bounty"
    uint public startTime; // starts predictions
    uint public endTime; // deadline
    uint public expiryTime; // expiry date
    // staking params
    mapping(bool => uint) public lastUpdateTime;
    mapping(bool => uint) public rewardPerTokenStored;
    mapping(bool => mapping(address => uint)) public userRewardPerTokenPaid;
    mapping(bool => mapping(address => uint)) public rewards;
    mapping(bool => mapping(address => uint)) private _balances;
    mapping(bool => uint) private _totalSupply;
    // answer
    bool public isCorrect;
    bool public isCorrectSet;

    event Predict(address indexed user, bool isCorrect, uint amount);
    event Claim(address indexed user, uint amount);

    constructor(address _owner, string memory _name, uint _startTime, uint _endTime, uint _expiryTime) Ownable(_owner) {
        require(_startTime > block.timestamp, "Start time must be in the future");
        require(_startTime < _endTime, "Start time must be before end time");
        require(_endTime < _expiryTime, "End time must be before expiry time");
        name = _name;
        startTime = _startTime;
        expiryTime = _expiryTime;
        endTime = _endTime;
        lastUpdateTime[true] = startTime;
        lastUpdateTime[false] = startTime;
    }

    /* ========== MODIFIERS ========== */

    modifier updateReward(address account, bool _isCorrect) {
        rewardPerTokenStored[_isCorrect] = rewardPerToken(_isCorrect);
        lastUpdateTime[_isCorrect] = lastTimeRewardApplicable();
        if (account != address(0)) {
            rewards[_isCorrect][account] = earned(account, _isCorrect);
            userRewardPerTokenPaid[_isCorrect][account] = rewardPerTokenStored[_isCorrect];
        }
        _;
    }

    /* ========== MUTATIVE FUNCTIONS ========== */

    /**
     * @dev Predict whether the answer is correct or not
     * @param _isCorrect Whether the answer is correct or not
     */
    function predict(bool _isCorrect) public payable updateReward(_msgSender(), _isCorrect) {
        require(block.timestamp >= startTime, "You can't predict yet");
        require(block.timestamp < endTime, "You can't predict anymore");
        require(msg.value > 0, "You must send some ether");

        _totalSupply[_isCorrect] = _totalSupply[_isCorrect] + msg.value;
        _balances[_isCorrect][_msgSender()] = _balances[_isCorrect][_msgSender()] + msg.value;
        emit Predict(_msgSender(), _isCorrect, msg.value);
    }

    /**
     * @dev Claim the bounty
     */
    function claim() public nonReentrant updateReward(_msgSender(), isCorrect) {
        require(block.timestamp >= endTime, "You can't claim yet");
        require(isCorrectSet, "You can't claim yet");
        uint reward = rewards[isCorrect][_msgSender()];
        require(reward > 0, "Nothing to claim");
        rewards[isCorrect][_msgSender()] = 0;
        uint rewardRate = _totalSupply[!isCorrect] / (endTime - startTime);
        uint amount = _balances[isCorrect][_msgSender()] + (reward * rewardRate);
        _msgSender().call{ value: amount }("");
        emit Claim(_msgSender(), amount);
    }

    function withdrawExpired() public nonReentrant {
        require(block.timestamp >= expiryTime, "You can't withdraw");
        require(!isCorrectSet, "You can't withdraw");
        uint amount = _balances[true][_msgSender()] + _balances[false][_msgSender()];
        _balances[true][_msgSender()] = 0;
        _balances[false][_msgSender()] = 0;
        _msgSender().call{ value: amount }("");
    }

    /* ========== VIEWS ========== */

    function balanceOf(address account, bool _isCorrect) external view returns (uint256) {
        return _balances[_isCorrect][account];
    }

    function totalSupply(bool _isCorrect) external view returns (uint256) {
        return _totalSupply[_isCorrect];
    }

    function lastTimeRewardApplicable() public view returns (uint256) {
        return block.timestamp < endTime ? block.timestamp : endTime;
    }

    function rewardPerToken(bool _isCorrect) public view returns (uint256) {
        if (_totalSupply[_isCorrect] == 0) {
            return rewardPerTokenStored[_isCorrect];
        }
        return
            rewardPerTokenStored[_isCorrect] + ((lastTimeRewardApplicable() - lastUpdateTime[_isCorrect]) * 1e18) / _totalSupply[_isCorrect];
    }

    function earned(address account, bool _isCorrect) public view returns (uint256) {
        return ((_balances[_isCorrect][account] * (rewardPerToken(_isCorrect) - userRewardPerTokenPaid[_isCorrect][account])) / 1e18) + rewards[_isCorrect][account];
    }

    /* ========== ADMIN ========== */

    /**
     * @dev Set the correct answer
     * @param _isCorrect Whether the answer is correct or not
     */
    function setIsCorrect(bool _isCorrect) public onlyOwner() {
        require(block.timestamp >= endTime, "You can't set the correct answer yet");
        require(!isCorrectSet, "You already set the correct answer");

        isCorrectSet = true;
        isCorrect = _isCorrect;
    }
}
