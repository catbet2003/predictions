// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

import "hardhat/console.sol";

contract Prediction {
    address public owner;
    string public name; // e.g. "Ismail Haniyeh Bounty"
    uint public startTime; // starts predictions
    uint public endPredictions; // ends predictions
    uint public endTime; // deadline
    bool public isCorrect;
    bool public isCorrectSet;

    struct UserPrediction {
        uint amount;
        bool isWithdrawn;
    }
    
    mapping(address => UserPrediction) public predictionsCorrect; // correct predictions
    mapping(address => UserPrediction) public predictionsIncorrect; // incorrect predictions

    uint public totalCorrect; // total amount of correct predictions
    uint public totalIncorrect; // total amount of incorrect predictions

    uint constant public INITIAL_RESERVE = 10_000 ether; // reserve of tokens

    uint public reserveCorrect = INITIAL_RESERVE; // reserve of correct predictions
    uint public reserveIncorrect = INITIAL_RESERVE; // reserve of incorrect predictions

    event Predict(address indexed user, bool isCorrect, uint amount, uint amountOut);
    event Claim(address indexed user, uint amount);

    modifier onlyOwner() {
        require(msg.sender == owner, "You aren't the owner");
        _;
    }

    constructor(string memory _name, uint _startTime, uint _endPredictions, uint _endTime) {
        require(_startTime > block.timestamp, "Start time must be in the future");
        require(_startTime < _endPredictions, "Start time must be before end predictions");
        require(_endPredictions < _endTime, "End predictions must be before end time");
        owner = tx.origin;
        name = _name;
        startTime = _startTime;
        endPredictions = _endPredictions;
        endTime = _endTime;
    }

    /**
     * @dev Predict whether the answer is correct or not
     * @param _isCorrect Whether the answer is correct or not
     */
    function predict(bool _isCorrect) public payable {
        require(block.timestamp >= startTime, "You can't predict yet");
        require(block.timestamp < endPredictions, "You can't predict anymore");
        require(msg.value > 0, "You must send some ether");

        if (_isCorrect) {
            uint amount = getAmount(msg.value, true);
            predictionsCorrect[msg.sender].amount += amount;
            reserveCorrect -= amount;
            totalCorrect += msg.value;
            emit Predict(msg.sender, _isCorrect, msg.value, amount);
        } else {
            uint amount = getAmount(msg.value, false);
            predictionsIncorrect[msg.sender].amount += amount;
            reserveIncorrect -= amount;
            totalIncorrect += msg.value;
            emit Predict(msg.sender, _isCorrect, msg.value, amount);
        }
    }

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

    /**
     * @dev Claim the bounty
     */
    function claim() public {
        require(block.timestamp >= endTime, "You can't claim yet");
        require(isCorrectSet, "You can't claim yet");
        require(!predictionsCorrect[msg.sender].isWithdrawn, "You already claim");
        require(!predictionsIncorrect[msg.sender].isWithdrawn, "You already claim");

        if (isCorrect) {
            require(predictionsCorrect[msg.sender].amount > 0, "You didn't predict correctly");
            predictionsCorrect[msg.sender].isWithdrawn = true;
            uint amount = (totalIncorrect + totalCorrect) * predictionsCorrect[msg.sender].amount / (INITIAL_RESERVE - reserveCorrect);
            emit Claim(msg.sender, amount);
            payable(msg.sender).transfer(amount);
        } else {
            require(predictionsIncorrect[msg.sender].amount > 0, "You didn't predict correctly");
            predictionsIncorrect[msg.sender].isWithdrawn = true;
            uint amount = (totalIncorrect + totalCorrect) * predictionsIncorrect[msg.sender].amount / (INITIAL_RESERVE - reserveIncorrect);
            emit Claim(msg.sender, amount);
            payable(msg.sender).transfer(amount);
        }
    }

    /**
     * @dev Gets the amount of "tokens" for a given amount of ether
     */
    function getAmount(uint amount, bool _isCorrect) public view returns (uint) {
        if (_isCorrect) {
            return getAmountOut(amount, totalCorrect > 0 ? totalCorrect : 1 ether, reserveCorrect);
        } else {
            return getAmountOut(amount, totalIncorrect > 0 ? totalIncorrect : 1 ether, reserveIncorrect);
        }
    }

    /**
     * @dev from UniswapV2Library.sol
     * @notice given an input amount of an asset and pair reserves, returns the maximum output amount of the other asset
     */
    function getAmountOut(uint amountIn, uint reserve0, uint reserve1) internal pure returns (uint amountOut) {
        require(amountIn > 0, 'Prediction: INSUFFICIENT_INPUT_AMOUNT');
        require(reserve0 > 0 && reserve1 > 0, 'Prediction: INSUFFICIENT_LIQUIDITY');
        uint amountInWithFee = amountIn * 997;
        uint numerator = amountInWithFee * reserve1;
        uint denominator = reserve0 * 1000 + amountInWithFee;
        amountOut = numerator / denominator;
    }
}
