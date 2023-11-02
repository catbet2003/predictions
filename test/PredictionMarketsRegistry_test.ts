import {
    time,
    loadFixture,
  } from "@nomicfoundation/hardhat-toolbox/network-helpers";
const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("PredictionMarketsRegistry", function () {

  async function deploy() {
    const ONE_WEEK_IN_SECS = 7 * 24 * 60 * 60;
    const THREE_DAYS_IN_SECS = 3 * 24 * 60 * 60;

    const startTime = await time.latest() + 60; // 60 seconds in the future
    const endTime = startTime + THREE_DAYS_IN_SECS;
    const expiryTime = startTime + ONE_WEEK_IN_SECS;

    // Contracts are deployed using the first signer/account by default
    const [owner, account1, account2, account3] = await ethers.getSigners();

    const Registry = await ethers.getContractFactory("PredictionMarketsRegistry");
    const registry = await Registry.deploy();
    /* const Prediction = await ethers.getContractFactory("Prediction");
    //const prediction = await Prediction.deploy("Ismail Haniyeh", startTime, endPredictions, endTime); */

    return { registry, startTime, endTime, expiryTime, owner, account1, account2, account3 };
  }

  it("Should create a prediction market and emit an event", async function () {
    
    const { registry, owner, startTime, endTime, expiryTime } = await loadFixture(deploy);

    const name = "Test Prediction";

    await expect(registry.connect(owner).createPredictionMarket(name, startTime, endTime, expiryTime))
    .to.emit(registry, "Create")
  });

  it("Should get the addresses of created prediction markets", async function () {
    const { registry, startTime, endTime, expiryTime} = await loadFixture(deploy);

    await registry.createPredictionMarket("Ismail Haniyeh", startTime, endTime, expiryTime);

    const predictionAddresses = await registry.getPredictionMarkets();
    expect(predictionAddresses).to.be.an("array").with.lengthOf(1);
  });

  it("Should prevent non-owner from creating a prediction market", async function () {

    const { registry, owner, account1, startTime, endTime, expiryTime } = await loadFixture(deploy);

    const name = "Test Prediction";
    const PredictionMarketsRegistry = await ethers.getContractFactory("PredictionMarketsRegistry");

    await expect(
      registry.connect(account1).createPredictionMarket(name, startTime, endTime, expiryTime)
    ).to.be.revertedWithCustomError({ interface: PredictionMarketsRegistry.interface }, 'OwnableUnauthorizedAccount')
    .withArgs(account1.address);
  });
});
