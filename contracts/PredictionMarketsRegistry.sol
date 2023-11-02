// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/utils/Context.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./PredictionMarket.sol";

/**
 * @title Prediction markets Registry Contract
 * @dev This contract allows users to create new prediction markets.
 */
contract PredictionMarketsRegistry is Ownable {
    address[] private _predictionMarkets;

    event Create(address predictionMarket, string name);

    constructor() Ownable(_msgSender()) {}

    /**
     * @dev Create a new prediction market
     * @param _name Name of the prediction
     * @param _startTime When the prediction starts
     * @param _endTime When the prediction ends
     * @param _expiryTime When the prediction expires
     */
    function createPredictionMarket(
        string memory _name,
        uint256 _startTime,
        uint256 _endTime,
        uint256 _expiryTime
    ) public onlyOwner returns (address) {
        PredictionMarket predictionMarket = new PredictionMarket(owner(), _name, _startTime, _endTime, _expiryTime);
        address predictionAddress = address(predictionMarket);
        _predictionMarkets.push(predictionAddress);

        emit Create(predictionAddress, _name);

        return predictionAddress;
    }

    /**
     * @dev Get the addresses of all created prediction markets.
     */
    function getPredictionMarkets() public view returns (address[] memory) {
        return _predictionMarkets;
    }
}
