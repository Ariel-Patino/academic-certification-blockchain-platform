// Deploys the default Truffle migration contract required by the framework.
const Migrations = artifacts.require("Migrations");

module.exports = function (deployer) {
  deployer.deploy(Migrations);
};
