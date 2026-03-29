// Registers and verifies the deployer wallet as an authorized issuer.
// Run with: truffle exec scripts/register-issuer.js --network polygonAmoy
const AcademicCertification = artifacts.require("AcademicCertification");

module.exports = async function (callback) {
  try {
    const accounts = await web3.eth.getAccounts();
    const admin = accounts[0];
    console.log("Admin wallet:", admin);

    const contract = await AcademicCertification.deployed();
    console.log("Contract address:", contract.address);

    // Check if already authorized before sending transactions
    const alreadyAuthorized = await contract.isAuthorizedIssuer(admin);
    if (alreadyAuthorized) {
      console.log("isAuthorizedIssuer: true (already set up, nothing to do)");
      return callback();
    }

    console.log("Registering issuer...");
    const tx1 = await contract.registerIssuer("Universidad Test", "España", "https://example.com", { from: admin });
    console.log("registerIssuer tx:", tx1.tx);

    console.log("Verifying issuer...");
    const tx2 = await contract.verifyIssuer(admin, { from: admin });
    console.log("verifyIssuer tx:", tx2.tx);

    const ok = await contract.isAuthorizedIssuer(admin);
    console.log("isAuthorizedIssuer:", ok); 

    callback();
  } catch (error) {
    console.error("Error:", error.message);
    callback(error);
  }
};