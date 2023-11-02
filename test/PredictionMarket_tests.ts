import {
  time,
  loadFixture,
} from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { expect } from "chai";
import { ethers } from "hardhat";
import BigNumber from "bignumber.js";

describe("PredictionMarket", function () {
  // We define a fixture to reuse the same setup in every test.
  // We use loadFixture to run this setup once, snapshot that state,
  // and reset Hardhat Network to that snapshot in every test.
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
    const tx = await registry.createPredictionMarket("Ismail Haniyeh", startTime, endTime, expiryTime);
    const rc: any = await tx.wait();
    const predictionAddress = rc.logs[1].args[0];
    const prediction = await ethers.getContractAt("PredictionMarket", predictionAddress);
    /* const Prediction = await ethers.getContractFactory("Prediction");
    const prediction = await Prediction.deploy("Ismail Haniyeh", startTime, endPredictions, endTime); */

    return { registry, prediction, startTime, endTime, expiryTime, owner, account1, account2, account3 };
  }
  
  describe("Constructor", function () {
    it("Should set the correct initial state", async function () {
      const { prediction, owner } = await loadFixture(deploy);
  
      const marketName = "Ismail Haniyeh";
      const startTime = await prediction.startTime();
      const endTime = await prediction.endTime();
      const expiryTime = await prediction.expiryTime();
  
      expect(await prediction.owner()).to.equal(owner.address);
      expect(await prediction.marketName()).to.equal(marketName);
      expect(startTime).to.be.above(0); // Ensure startTime is greater than 0
      expect(endTime).to.be.above(startTime); // Ensure endTime is after startTime
      expect(expiryTime).to.be.above(endTime); // Ensure expiryTime is after endTime
    });
  
    it("Should revert if the owner is the zero address", async function () {
      const { owner } = await loadFixture(deploy);
      const startTime = await time.latest() + 60; // 60 seconds in the future
      const endTime = startTime + 24 * 60 * 60;
      const expiryTime = startTime + 7 * 24 * 60 * 60;
      const Prediction = await ethers.getContractFactory("PredictionMarket");

      await expect(
        Prediction.deploy(ethers.ZeroAddress, "test", startTime, endTime, expiryTime )
      ).to.be.revertedWithCustomError({ interface: Prediction.interface }, 'OwnableInvalidOwner')
      .withArgs(ethers.ZeroAddress);

    });
  
    it("Should revert if the startTime is not in the future", async function () {
      const [owner] = await ethers.getSigners();
      const latestTime = await time.latest();
      const startTime = latestTime - 60; // 60 seconds in the past
      const endTime = startTime + 24 * 60 * 60;
      const expiryTime = startTime + 7 * 24 * 60 * 60;
      const Prediction = await ethers.getContractFactory("PredictionMarket");

      await expect(
        Prediction.deploy(owner, "test", startTime, endTime, expiryTime )
      ).to.be.revertedWith("Start time must be in the future");
    });
  
    it("Should revert if the startTime is not before the endTime", async function () {
      const [owner] = await ethers.getSigners();
      const startTime = await time.latest() + 60; // 60 seconds in the future
      const endTime = startTime - 60; // 60 seconds in the past
      const expiryTime = startTime + 7 * 24 * 60 * 60;
      const Prediction = await ethers.getContractFactory("PredictionMarket");

      await expect(
        Prediction.deploy(owner, "test", startTime, endTime, expiryTime )
      ).to.be.revertedWith("Start time must be before end time");
    });
  
    it("Should revert if the endTime is not before the expiryTime", async function () {
      const [owner] = await ethers.getSigners();
      const startTime = await time.latest() + 60; // 60 seconds in the future
      const endTime = startTime + 7 * 24 * 60 * 60; // 7 days in the future
      const expiryTime = startTime + 24 * 60 * 60; // 1 day in the future
      const Prediction = await ethers.getContractFactory("PredictionMarket");

      await expect(
        Prediction.deploy(owner, "test", startTime, endTime, expiryTime )
      ).to.be.revertedWith("End time must be before expiry time");
    });
  });

  describe("Predict: Validation", function () {
    it("Should allow a prediction within the prediction window", async function () {
      const { prediction, startTime, endTime } = await loadFixture(deploy);
  
      await time.increaseTo(startTime + 10); // Prediction window is open
      await expect(prediction.predict(true, { value: ethers.parseUnits("1", "ether") })).to.not.be.reverted;
    });
  
    it("Should revert if prediction is made before the prediction window", async function () {
      const { prediction, startTime, endTime } = await loadFixture(deploy);
  
      await time.increaseTo(startTime - 10); // Prediction window is not open yet
      await expect(prediction.predict(true, { value: ethers.parseUnits("1", "ether") })).to.be.revertedWith("Prediction window is closed");
    });
  
    it("Should revert if prediction is made after the prediction window", async function () {
      const { prediction, startTime, endTime } = await loadFixture(deploy);
  
      await time.increaseTo(endTime + 10); // Prediction window is closed
      await expect(prediction.predict(true, { value: ethers.parseUnits("1", "ether") })).to.be.revertedWith("Prediction window is closed");
    });
  
    it("Should revert if prediction is made without sending ETH", async function () {
      const { prediction, startTime } = await loadFixture(deploy);
  
      await time.increaseTo(startTime + 10); // Prediction window is open
      await expect(prediction.predict(true, { value: 0 })).to.be.revertedWith("Must send ETH to predict");
    });
  });
  

  describe("Events", function () {
    it("Should emit an event on predict", async function () {
      const { prediction, startTime, account1 } = await loadFixture(
        deploy
      );

      await time.increaseTo(startTime);

      const amount = ethers.parseUnits("1000", "ether");

      await expect(prediction.connect(account1).predict(false, { value: amount }))
        .to.emit(prediction, "Predicted")
        .withArgs(account1.address, false, amount);
    });

    it("Should emit an event on claim", async function () {
      const { prediction, startTime, endTime, account1, account2, account3 } = await loadFixture(
        deploy
      );

      await time.increaseTo(startTime);

      await prediction.connect(account1).predict(true, { value: ethers.parseUnits("20", "ether") });

      await prediction.connect(account2).predict(false, { value: ethers.parseUnits("31", "ether") });

      await prediction.connect(account3).predict(false, { value: ethers.parseUnits("12", "ether") });

      await time.increaseTo(endTime);

      await prediction.setOutcome(false);

      const expectedRevenue = BigNumber(ethers.parseUnits(String((31 / 43 * 20 + 31)), "ether").toString());

      await expect(prediction.connect(account2).claim())
        .to.emit(prediction, "Claimed")
        .withArgs(account2.address, expectedRevenue.toFixed(0));
    });

    it("Should emit an event on claim 2", async function () {
      const { prediction, startTime, endTime, account1, account2, account3 } = await loadFixture(
        deploy
      );

      await time.increaseTo(startTime);

      await prediction.connect(account1).predict(true, { value: ethers.parseUnits("5", "ether") });

      await prediction.connect(account2).predict(false, { value: ethers.parseUnits("2.3", "ether") });

      await prediction.connect(account3).predict(false, { value: ethers.parseUnits("1", "ether") });

      await time.increaseTo(endTime);

      await prediction.setOutcome(true);

      await expect(prediction.connect(account1).claim())
        .to.emit(prediction, "Claimed")
        .withArgs(account1.address, ethers.parseUnits("8.3", "ether"));
    });
  });

  describe("Claim", function () {
    
    // it("Should allow a user to claim rewards if predictions are over and they have rewards", async function () {
    //   const { prediction, startTime, endTime, account1, account2, account3 } = await loadFixture(deploy);
    
    //   await time.increaseTo(startTime);
    
    //   await prediction.connect(account1).predict(true, { value: ethers.parseUnits("1", "ether") });
    //   await prediction.connect(account2).predict(false, { value: ethers.parseUnits("2", "ether") });
    //   await prediction.connect(account3).predict(false, { value: ethers.parseUnits("3", "ether") });
    
    //   console.log("prediction: " + await ethers.provider.getBalance(prediction))

    //   await time.increaseTo(endTime);
    //   await prediction.setOutcome(false);
    
    //   const initialBalance = await ethers.provider.getBalance(account2.address);
    //   await prediction.connect(account2).claim();
    //   console.log("prediction #2: " + await ethers.provider.getBalance(prediction))

    //   await prediction.connect(account3).claim();
    //   console.log("prediction #3: " + await ethers.provider.getBalance(prediction))

    //   // const newBalance = await ethers.provider.getBalance(account2.address);
    
    //   // const expectedRevenue = ethers.parseUnits(String((31 / 43 * 20 + 31)), "ether");
    //   // const expectedBalance = initialBalance + expectedRevenue;
      

    //   // console.log(newBalance.toLocaleString())
    //   // console.log(initialBalance.toLocaleString())
    //   // console.log(expectedRevenue.toLocaleString())
    //   // console.log(expectedBalance.toLocaleString())

    
    //   // expect(newBalance).to.be.equal(expectedBalance);
    // });
    
    // it("Should revert if a user with incorrect predictions tries to claim", async function () {
    //   const { prediction, startTime, endTime, account1, account2, account3 } = await loadFixture(deploy);
    
    //   await time.increaseTo(startTime);
    
    //   await prediction.connect(account1).predict(true, { value: ethers.parseUnits("20", "ether") });
    //   await prediction.connect(account2).predict(false, { value: ethers.parseUnits("31", "ether") });
    //   await prediction.connect(account3).predict(false, { value: ethers.parseUnits("12", "ether") });
    
    //   await time.increaseTo(endTime);
    //   await prediction.setOutcome(false);
    
    //   await expect(prediction.connect(account1).claim()).to.be.revertedWith("Nothing to claim");
    // });
    
    // it("Should calculate the correct reward when a user with correct predictions claims", async function () {
    //   const { prediction, startTime, endTime, account1, account2, account3 } = await loadFixture(deploy);
    
    //   await time.increaseTo(startTime);
    
    //   await prediction.connect(account1).predict(true, { value: ethers.parseUnits("20", "ether") });
    //   await prediction.connect(account2).predict(false, { value: ethers.parseUnits("31", "ether") });
    //   await prediction.connect(account3).predict(false, { value: ethers.parseUnits("12", "ether") });
    
    //   await time.increaseTo(endTime);
    //   await prediction.setOutcome(false);
    
    //   await prediction.connect(account2).claim();
    
    //   const account2Reward = await prediction.earned(account2, false);
    //   const expectedRevenue = ethers.parseUnits(String(31 * 20 / 43), "ether");
    
    //   expect(account2Reward).to.be.equal(expectedRevenue);
    // });
  });

  describe("RecoverERC20", function () {
    it('should allow the owner to recover ERC20 tokens', async function () {

      const { prediction, owner, account1, account2, account3 } = await loadFixture(deploy);

      // Deploy a mock ERC20 token
      const MockERC20 = await ethers.getContractFactory('MockERC20');
      const mockToken = await MockERC20.deploy();

      const initialBalance = await mockToken.balanceOf(owner.address);

      // Call the recoverERC20 function to recover ERC20 tokens
      const recoverAmount = ethers.parseUnits('500', 'ether');
      mockToken.mint(prediction.getAddress(), recoverAmount)
      await prediction.recoverERC20(mockToken.getAddress(), recoverAmount);

      const updatedBalance = await mockToken.balanceOf(owner.address);

      // Verify that the owner's balance increased by the recovered amount
      expect(updatedBalance).to.equal(initialBalance + recoverAmount);
    });
  });

  describe("SetOutcome", function () {
    it("Should allow the owner to set the outcome", async function () {
        const { prediction, owner } = await loadFixture(deploy);

        // Ensure that the initial answer is 0 (unanswered)
        let data = await prediction.predictionData();
        const initialAnswer = data[4];
        expect(initialAnswer).to.equal(0, "Initial answer should be 0");

        // Set the outcome to true (1)
        await prediction.setOutcome(true, { from: owner });

        // Verify that the answer has been set to 1 (true)
        data = await prediction.predictionData();
        const newAnswer = data[4];
        expect(newAnswer).to.equal(1, "Outcome should be set to 1 (true)");

        // Try to set the outcome again, it should fail since the answer is already set
        await expect(
          prediction.setOutcome(false, { from: owner })
        ).to.be.revertedWith("Answer already set");
    });

    it("Should not allow non-owners to set the outcome", async function () {
        const { prediction, owner, account1 } = await loadFixture(deploy);

        // Try to set the outcome as a non-owner, it should fail
        try {
          await prediction.setOutcome(true, { from: account1 });
          throw new Error("Setting outcome after it's already set should fail");
        } catch (error: any) {
          expect(error.message).to.include("address mismatch", "Expected error message");
        }
    });

    it("Should not allow setting outcome after expiry time", async function () {
      const { prediction, owner } = await loadFixture(deploy);

      // Fast-forward the blockchain time to be after expiryTime
      let newTime = await prediction.expiryTime();
      await time.increaseTo(Number(newTime) + 1);

      // Try to set the outcome after expiry time, it should fail
      try {
        await prediction.setOutcome(true, { from: owner });
        throw new Error("Setting outcome after expiry time should fail");
      } catch (error: any) {
        expect(error.message).to.include("Cannot set answer after expiry time", "Expected error message");
      }
    });

    it("Should not allow the owner to set the outcome if answer is already set", async function () {
      const { prediction, owner } = await loadFixture(deploy);
      
      // Set the outcome to true (1)
      await prediction.setOutcome(true);

      // Try to set the outcome again, it should fail since the answer is already set
      await expect(prediction.setOutcome(false)).to.be.revertedWith("Answer already set");
    });

    it("Should allow the owner to set the outcome to true if answer is not set and within expiry time", async function () {
      const { prediction, owner } = await loadFixture(deploy);
      await prediction.setOutcome(true);
      let data = await prediction.predictionData();
      const newAnswer = data[4];
      expect(newAnswer).to.equal(1, "Outcome should be set to 1 (true)");
    });

    it("Should allow the owner to set the outcome to false if answer is not set and within expiry time", async function () {
        const { prediction, owner } = await loadFixture(deploy);
        await prediction.setOutcome(false);
        let data = await prediction.predictionData();
        const newAnswer = data[4];
        expect(newAnswer).to.equal(2, "Outcome should be set to 2 (false)");
    });
  });

  describe("@ithdrawExpired", function () {
    it("Should allow the owner to withdraw expired funds", async function () {
      const { prediction, owner, account1, startTime, expiryTime } = await loadFixture(deploy);

      await time.increaseTo(startTime + 10); // Prediction window is open

      // Predict first (assuming the function predict is available)
      await prediction.connect(account1).predict(true, { value: ethers.parseUnits("1", "ether") });
      
      // Increase the time to after the expiry time
      await time.increaseTo(expiryTime + 10);

      // Withdraw the expired funds by the owner
      await expect(prediction.connect(account1).withdrawExpired())
          .to.emit(prediction, "WithdrawnExpiredStake")
          .withArgs(account1.address, ethers.parseUnits("1", "ether")); // Adjust the value based on your contract
    });

    it("Should not allow withdrawal before the expiry time", async function () {
        const { prediction, owner, account1, startTime, expiryTime } = await loadFixture(deploy);

        await time.increaseTo(startTime + 10); // Prediction window is open

        // Predict first (assuming the function predict is available)
        await prediction.connect(account1).predict(true, { value: ethers.parseUnits("1", "ether") });

        // Try to withdraw before the expiry time, it should fail
        await expect(prediction.connect(owner).withdrawExpired()).to.be.revertedWith("Cannot withdraw before expiry time");
    });

    it("Should not allow withdrawal if the outcome has been set", async function () {
        const { prediction, owner, account1, startTime, expiryTime } = await loadFixture(deploy);

        await time.increaseTo(startTime + 10); // Prediction window is open

        // Predict first (assuming the function predict is available)
        await prediction.connect(account1).predict(true, { value: ethers.parseUnits("1", "ether") });

        // Set the outcome (assuming the function setOutcome is available)
        await prediction.connect(owner).setOutcome(true);

        // Increase the time to after the expiry time
        await time.increaseTo(expiryTime + 10);

        // Try to withdraw after the outcome has been set, it should fail
        await expect(prediction.connect(owner).withdrawExpired()).to.be.revertedWith("Outcome has been set");
    });

    it("Should allow the owner to withdraw expired funds after multiple predictions", async function () {
        const { prediction, owner, account1, startTime, expiryTime } = await loadFixture(deploy);

        await time.increaseTo(startTime + 10); // Prediction window is open

        // Predict multiple times (assuming the function predict is available)
        await prediction.connect(account1).predict(true, { value: ethers.parseUnits("1", "ether") });
        await prediction.connect(account1).predict(false, { value: ethers.parseUnits("0.5", "ether") });
        await prediction.connect(account1).predict(true, { value: ethers.parseUnits("2", "ether") });

        // Increase the time to after the expiry time
        await time.increaseTo(expiryTime + 10);

        // Withdraw the expired funds by the owner
        await expect(prediction.connect(account1).withdrawExpired())
            .to.emit(prediction, "WithdrawnExpiredStake")
            .withArgs(account1.address, ethers.parseUnits("3.5", "ether")); // Adjust the value based on your contract
    });

    it("Should not allow a user with correct predictions to withdraw before expiry", async function () {
      const { prediction, owner, account1, startTime, expiryTime } = await loadFixture(deploy);

      await time.increaseTo(startTime + 10); // Prediction window is open

      // Predict correctly (assuming the function predict is available)
      await prediction.connect(account1).predict(true, { value: ethers.parseUnits("1", "ether") });

      // Try to withdraw as a user with correct predictions before expiry, it should fail
      await expect(prediction.connect(account1).withdrawExpired()).to.be.revertedWith("Cannot withdraw before expiry time");
    });

    it("Should allow multiple users to withdraw their expired stakes after expiry", async function () {
      const { prediction, owner, account1, account2, account3, startTime, expiryTime } = await loadFixture(deploy);

      await time.increaseTo(startTime + 10); // Prediction window is open

      // Predict by multiple users (assuming the function predict is available)
      await prediction.connect(account1).predict(true, { value: ethers.parseUnits("1", "ether") });
      await prediction.connect(account2).predict(false, { value: ethers.parseUnits("2", "ether") });
      await prediction.connect(account3).predict(true, { value: ethers.parseUnits("3", "ether") });

      // Increase the time to after the expiry time
      await time.increaseTo(expiryTime + 10);

      // Withdraw expired stakes by multiple users
      await expect(prediction.connect(account1).withdrawExpired())
          .to.emit(prediction, "WithdrawnExpiredStake")
          .withArgs(account1.address, ethers.parseUnits("1", "ether")); // Adjust the value based on your contract

      await expect(prediction.connect(account2).withdrawExpired())
          .to.emit(prediction, "WithdrawnExpiredStake")
          .withArgs(account2.address, ethers.parseUnits("2", "ether")); // Adjust the value based on your contract

      await expect(prediction.connect(account3).withdrawExpired())
          .to.emit(prediction, "WithdrawnExpiredStake")
          .withArgs(account3.address, ethers.parseUnits("3", "ether")); // Adjust the value based on your contract
    });
  });

  describe("TotalSupply", function () {
    it("Should return the total supply for true predictions", async function () {
      const { prediction, account1 , startTime} = await loadFixture(deploy);
  
      await time.increaseTo(startTime + 10); // Prediction window is open

      // Assuming that the `predict` function is available
      await prediction.connect(account1).predict(true, { value: ethers.parseUnits("1", "ether") });
      await prediction.connect(account1).predict(true, { value: ethers.parseUnits("2", "ether") });
  
      const totalSupply = await prediction.totalSupply(true);
  
      expect(totalSupply).to.equal(ethers.parseUnits("3", "ether"));
    });
  
    it("Should return the total supply for false predictions", async function () {
      const { prediction, account1, startTime } = await loadFixture(deploy);
  
      await time.increaseTo(startTime + 10); // Prediction window is open

      // Assuming that the `predict` function is available
      await prediction.connect(account1).predict(false, { value: ethers.parseUnits("3", "ether") });
      await prediction.connect(account1).predict(false, { value: ethers.parseUnits("2", "ether") });
      await prediction.connect(account1).predict(false, { value: ethers.parseUnits("1", "ether") });
  
      const totalSupply = await prediction.totalSupply(false);
  
      expect(totalSupply).to.equal(ethers.parseUnits("6", "ether"));
    });
  
    it("Should return zero for predictions with no stakes", async function () {
      const { prediction } = await loadFixture(deploy);
  
      const totalSupply = await prediction.totalSupply(true);
  
      expect(totalSupply).to.equal(0);
    });
  });

  describe("BalanceOf", function () {
    it("Should return the balance of an account for true predictions", async function () {
      const { prediction, account1, startTime } = await loadFixture(deploy);
  
      await time.increaseTo(startTime + 10); // Prediction window is open
  
      // Assuming that the `predict` function is available
      await prediction.connect(account1).predict(true, { value: ethers.parseUnits("1", "ether") });
      await prediction.connect(account1).predict(true, { value: ethers.parseUnits("2", "ether") });
  
      const balance = await prediction.balanceOf(account1, true);
  
      expect(balance).to.equal(ethers.parseUnits("3", "ether"));
    });
  
    it("Should return the balance of an account for false predictions", async function () {
      const { prediction, account1, startTime } = await loadFixture(deploy);
  
      await time.increaseTo(startTime + 10); // Prediction window is open
  
      // Assuming that the `predict` function is available
      await prediction.connect(account1).predict(false, { value: ethers.parseUnits("3", "ether") });
      await prediction.connect(account1).predict(false, { value: ethers.parseUnits("2", "ether") });
      await prediction.connect(account1).predict(false, { value: ethers.parseUnits("1", "ether") });
  
      const balance = await prediction.balanceOf(account1, false);
  
      expect(balance).to.equal(ethers.parseUnits("6", "ether"));
    });
  
    it("Should return zero for accounts with no stakes", async function () {
      const { prediction, account1, startTime } = await loadFixture(deploy);
  
      await time.increaseTo(startTime + 10); // Prediction window is open
  
      const balance = await prediction.balanceOf(account1, true);
  
      expect(balance).to.equal(0);
    });
  
    it("Should return zero for an account with stakes in the opposite prediction", async function () {
      const { prediction, account1, startTime } = await loadFixture(deploy);
  
      await time.increaseTo(startTime + 10); // Prediction window is open
  
      // Assuming that the `predict` function is available
      await prediction.connect(account1).predict(true, { value: ethers.parseUnits("1", "ether") });
  
      const balance = await prediction.balanceOf(account1, false);
  
      expect(balance).to.equal(0);
    });
  });

  describe("CorrectPrediction", function () {
    it("Should return true if the outcome is set to true", async function () {
      const { prediction } = await loadFixture(deploy);
  
      // Assuming the `setOutcome` function is available
      await prediction.setOutcome(true);
  
      const isCorrect = await prediction.correctPrediction();
  
      expect(isCorrect).to.be.true;
    });
  
    it("Should return false if the outcome is set to false", async function () {
      const { prediction } = await loadFixture(deploy);
  
      // Assuming the `setOutcome` function is available
      await prediction.setOutcome(false);
  
      const isCorrect = await prediction.correctPrediction();
  
      expect(isCorrect).to.be.false;
    });
  
    it("Should revert if the outcome is not set yet", async function () {
      const { prediction } = await loadFixture(deploy);
  
      // Attempt to call correctPrediction without setting the outcome, it should revert
      await expect(prediction.correctPrediction()).to.be.revertedWith("Outcome has not been set yet");
    });
  });
});
