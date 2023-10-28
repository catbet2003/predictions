// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

import "./Prediction.sol";

contract PredictionsRegistry {
    address public owner;
    address[] public predictions;

    event Create(address prediction, string name);

    modifier onlyOwner() {
        require(msg.sender == owner, "You aren't the owner");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    /**
     * @dev Create a new prediction
     * @param _name Name of the prediction
     * @param _startTime When the prediction starts
     * @param _endPredictions When the prediction ends
     * @param _endTime When the prediction ends
     */
    function createPrediction(
        string memory _name,
        uint256 _startTime,
        uint256 _endPredictions,
        uint256 _endTime
    ) public onlyOwner returns (address) {
        Prediction prediction = new Prediction(_name, _startTime, _endPredictions, _endTime);
        predictions.push(address(prediction));

        emit Create(address(prediction), _name);

        return address(prediction);
    }
}
