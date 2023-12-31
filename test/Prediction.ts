// import {
//   time,
//   loadFixture,
// } from "@nomicfoundation/hardhat-toolbox/network-helpers";
// import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
// import { expect } from "chai";
// import { ethers } from "hardhat";
// import BigNumber from "bignumber.js";

// describe("Prediction", function () {
//   // We define a fixture to reuse the same setup in every test.
//   // We use loadFixture to run this setup once, snapshot that state,
//   // and reset Hardhat Network to that snapshot in every test.
//   async function deploy() {
//     const ONE_WEEK_IN_SECS = 7 * 24 * 60 * 60;
//     const THREE_DAYS_IN_SECS = 3 * 24 * 60 * 60;

//     const startTime = await time.latest() + 60; // 60 seconds in the future
//     const endTime = startTime + THREE_DAYS_IN_SECS;
//     const expiryTime = startTime + ONE_WEEK_IN_SECS;

//     // Contracts are deployed using the first signer/account by default
//     const [owner, account1, account2, account3] = await ethers.getSigners();

//     const Registry = await ethers.getContractFactory("PredictionMarketsRegistry");
//     const registry = await Registry.deploy();
//     const tx = await registry.createPredictionMarket("Ismail Haniyeh", startTime, endTime, expiryTime);
//     const rc: any = await tx.wait();
//     const predictionAddress = rc.logs[1].args[0];
//     const prediction = await ethers.getContractAt("PredictionMarket", predictionAddress);
//     /* const Prediction = await ethers.getContractFactory("Prediction");
//     const prediction = await Prediction.deploy("Ismail Haniyeh", startTime, endPredictions, endTime); */

//     return { registry, prediction, startTime, endTime, expiryTime, owner, account1, account2, account3 };
//   }

//   describe("Deployment", function () {
//     it("Should set the right times", async function () {
//       const { prediction, startTime, endTime, expiryTime } = await loadFixture(deploy);

//       expect(await prediction.startTime()).to.equal(startTime);
//       expect(await prediction.expiryTime()).to.equal(expiryTime);
//       expect(await prediction.endTime()).to.equal(endTime);
//     });

//     it("Should set the right owner", async function () {
//       const { prediction, owner } = await loadFixture(deploy);

//       expect(await prediction.owner()).to.equal(owner.address);
//     });

//     it("Should fail if the startTime is not in the future", async function () {
//       const [owner] = await ethers.getSigners();
//       const latestTime = await time.latest();
//       const Prediction = await ethers.getContractFactory("PredictionMarket");
//       await expect(Prediction.deploy(owner, "test", latestTime, latestTime + 1, latestTime + 2)).to.be.revertedWith(
//         "Start time must be in the future"
//       );
//     });
//   });

//   describe("Predictions", function () {
//     describe("Validations", function () {
//       it("Should revert with the right error if called too soon", async function () {
//         const { prediction } = await loadFixture(deploy);

//         await expect(prediction.predict(true)).to.be.revertedWith(
//           "Prediction window is closed"
//         );
//       });

//       it("Should revert with the right error if called after predictions are over", async function () {
//         const { prediction, endTime } = await loadFixture(
//           deploy
//         );
//         await time.increaseTo(endTime);

//         await expect(prediction.predict(true)).to.be.revertedWith(
//           "Prediction window is closed"
//         );
//       });

//       it("Should revert with the right error if called without a value", async function () {
//         const { prediction, startTime } = await loadFixture(
//           deploy
//         );
//         await time.increaseTo(startTime);

//         await expect(prediction.predict(true)).to.be.revertedWith(
//           "Must send ETH to predict"
//         );
//       });

//       it("Should revert if loosing side is trying to claim", async function () {
//         const { prediction, startTime, endTime, account1, account2, account3 } = await loadFixture(
//           deploy
//         );

//         await time.increaseTo(startTime);

//         await prediction.connect(account1).predict(true, { value: ethers.parseUnits("5", "ether") });

//         await prediction.connect(account2).predict(false, { value: ethers.parseUnits("2.3", "ether") });

//         await prediction.connect(account3).predict(false, { value: ethers.parseUnits("1", "ether") });

//         await time.increaseTo(endTime);

//         await prediction.setOutcome(false);

//         await expect(prediction.connect(account1).claim())
//           .to.be.revertedWith(
//             "Nothing to claim"
//           );
//       });

//       it("Should validate first user gets more than second user", async function () {
//         const { prediction, startTime, endTime, account1, account2, account3 } = await loadFixture(
//           deploy
//         );

//         await time.increaseTo(startTime);

//         await prediction.connect(account1).predict(true, { value: ethers.parseUnits("5", "ether") });

//         await prediction.connect(account2).predict(false, { value: ethers.parseUnits("1", "ether") });

//         await time.increaseTo(startTime + (endTime - startTime) / 2);

//         await prediction.connect(account3).predict(false, { value: ethers.parseUnits("5", "ether") });

//         await time.increaseTo(endTime);

//         await prediction.setOutcome(false);

//         const account2Earned = await prediction.earned(account2, false);
//         const account3Earned = await prediction.earned(account3, false);

//         console.log(account2Earned.toString(), account3Earned.toString());

//         expect(BigNumber(account2Earned.toString())).to.be.greaterThan(BigNumber(account3Earned.toString()));
//       });
//     });

//     describe("Events", function () {
//       it("Should emit an event on predict", async function () {
//         const { prediction, startTime, account1 } = await loadFixture(
//           deploy
//         );

//         await time.increaseTo(startTime);

//         const amount = ethers.parseUnits("1000", "ether");

//         await expect(prediction.connect(account1).predict(false, { value: amount }))
//           .to.emit(prediction, "Predicted")
//           .withArgs(account1.address, false, amount);
//       });
//       it("Should emit an event on claim", async function () {
//         const { prediction, startTime, endTime, account1, account2, account3 } = await loadFixture(
//           deploy
//         );

//         await time.increaseTo(startTime);

//         await prediction.connect(account1).predict(true, { value: ethers.parseUnits("20", "ether") });

//         await prediction.connect(account2).predict(false, { value: ethers.parseUnits("31", "ether") });

//         await prediction.connect(account3).predict(false, { value: ethers.parseUnits("12", "ether") });

//         await time.increaseTo(endTime);

//         await prediction.setOutcome(false);

//         const expectedRevenue = BigNumber(ethers.parseUnits(String((31 / 43 * 20 + 31)), "ether").toString());

//         await expect(prediction.connect(account2).claim())
//           .to.emit(prediction, "Claimed")
//           .withArgs(account2.address, expectedRevenue.toFixed(0));
//       });

//       it("Should emit an event on claim 2", async function () {
//         const { prediction, startTime, endTime, account1, account2, account3 } = await loadFixture(
//           deploy
//         );

//         await time.increaseTo(startTime);

//         await prediction.connect(account1).predict(true, { value: ethers.parseUnits("5", "ether") });

//         await prediction.connect(account2).predict(false, { value: ethers.parseUnits("2.3", "ether") });

//         await prediction.connect(account3).predict(false, { value: ethers.parseUnits("1", "ether") });

//         await time.increaseTo(endTime);

//         await prediction.setOutcome(true);

//         await expect(prediction.connect(account1).claim())
//           .to.emit(prediction, "Claimed")
//           .withArgs(account1.address, ethers.parseUnits("8.3", "ether"));
//       });
//     });

//     describe("Transfers", function () {
//       /* it("Should transfer the funds on claim", async function () {
//         const { prediction, startTime, endTime, account1, account2, account3 } = await loadFixture(
//           deploy
//         );

//         await time.increaseTo(startTime);

//         await prediction.connect(account1).predict(true, { value: ethers.parseUnits("5", "ether") });

//         await prediction.connect(account2).predict(false, { value: ethers.parseUnits("2.3", "ether") });

//         await prediction.connect(account3).predict(false, { value: ethers.parseUnits("1", "ether") });

//         await time.increaseTo(endTime);

//         await prediction.setOutcome(false);

//         const expectedRevenue = BigNumber(ethers.parseUnits("5", "ether").toString())
//           .multipliedBy(ethers.parseUnits("2.3", "ether").toString())
//           .dividedBy(ethers.parseUnits("3.3", "ether").toString())
//           .plus(ethers.parseUnits("2.3", "ether").toString());

//         const account2BalanceBefore = await ethers.provider.getBalance(account2.address);

//         const tx = await prediction.connect(account2).claim();

//         const receipt = await tx.wait();

//         const gasCostForTxn = BigNumber(receipt?.gasUsed.toString() || 0).multipliedBy(receipt?.gasPrice.toString() || 0);

//         const account2BalanceAfter = await ethers.provider.getBalance(account2.address);

//         expect(gasCostForTxn.plus(account2BalanceAfter.toString()).minus(account2BalanceBefore.toString())).to.equal(expectedRevenue.toFixed(0));
//       }); */
//     });
//   });
// });
