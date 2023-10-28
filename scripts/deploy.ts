import { ethers } from "hardhat";

async function main() {
  /* const Prediction = await ethers.getContractFactory("Prediction");
  const prediction = await Prediction.deploy("Ismail Haniyeh", startTime, endPredictions, endTime);

  await prediction.deployed();

  console.log("Prediction deployed to:", prediction.address); */
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
