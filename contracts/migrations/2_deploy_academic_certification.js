// Deploys the academic certification contract placeholder.
const AcademicCertification = artifacts.require("AcademicCertification");

module.exports = async function (deployer, network) {
  await deployer.deploy(AcademicCertification);

  const deployed = await AcademicCertification.deployed();
  console.log(`[deploy] Network: ${network}`);
  console.log(`[deploy] AcademicCertification: ${deployed.address}`);
};
