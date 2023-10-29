// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

import "hardhat/console.sol";
import "@openzeppelin/contracts/utils/Context.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./Prediction.sol";

contract PredictionsRegistry is Ownable {
    address[] public predictions;

    event Create(address prediction, string name);

    constructor() Ownable(_msgSender()) {}

    /**
     * @dev Create a new prediction
     * @param _name Name of the prediction
     * @param _startTime When the prediction starts
     * @param _endTime When the prediction ends
     * @param _expiryTime When the prediction expires
     */
    function createPrediction(
        string memory _name,
        uint256 _startTime,
        uint256 _endTime,
        uint256 _expiryTime
    ) public onlyOwner returns (address) {
        Prediction prediction = new Prediction(owner(), _name, _startTime, _endTime, _expiryTime);
        predictions.push(address(prediction));

        emit Create(address(prediction), _name);

        return address(prediction);
    }
}
