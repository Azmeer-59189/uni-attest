const hre = require("hardhat");

async function main() {
  console.log("Deploying DegreeAttestation contract...");

  const universityName = process.env.UNIVERSITY_NAME || "My University";

  const DegreeAttestation = await hre.ethers.getContractFactory("DegreeAttestation");
  const contract = await DegreeAttestation.deploy(universityName);

  await contract.waitForDeployment();

  const address = await contract.getAddress();

  console.log("─────────────────────────────────────────");
  console.log(`✅ DegreeAttestation deployed!`);
  console.log(`   Contract address : ${address}`);
  console.log(`   University name  : ${universityName}`);
  console.log(`   Network          : ${hre.network.name}`);
  console.log("─────────────────────────────────────────");
  console.log("\n📋 Add this to your server/.env:");
  console.log(`   CONTRACT_ADDRESS=${address}`);
  console.log("─────────────────────────────────────────");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Deployment failed:", error);
    process.exit(1);
  });