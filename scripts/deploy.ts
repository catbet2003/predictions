import {
  time,
} from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { ethers } from "hardhat";

async function main() {
  const ONE_WEEK_IN_SECS = 7 * 24 * 60 * 60;
  const THREE_DAYS_IN_SECS = 3 * 24 * 60 * 60;

  const startTime = await time.latest() + 60; // 60 seconds in the future
  const endTime = startTime + THREE_DAYS_IN_SECS;
  const expiryTime = startTime + ONE_WEEK_IN_SECS;
  const Registry = await ethers.getContractFactory("PredictionsRegistry");
  const registry = await Registry.deploy();
  const tx = await registry.createPrediction("Ismail Haniyeh", startTime, endTime, expiryTime);

  await registry.waitForDeployment();

  console.log("Registry deployed to:", registry.target);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
