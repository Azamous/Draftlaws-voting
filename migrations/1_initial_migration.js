const draftLaws = artifacts.require("DraftLaws");

module.exports = function (deployer) {
  deployer.deploy(draftLaws);
};
