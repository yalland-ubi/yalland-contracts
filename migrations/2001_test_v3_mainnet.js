/*
 * Copyright ©️ 2018 Galt•Project Society Construction and Terraforming Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka)
 *
 * Copyright ©️ 2018 Galt•Core Blockchain Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka) by
 * [Basic Agreement](ipfs/QmaCiXUmSrP16Gz8Jdzq6AJESY1EAANmmwha15uR3c1bsS)).
 */

const assert = require('assert');

const YALLTokenEthereum = artifacts.require('./YALLTokenEthereum');
const { web3 } = YALLTokenEthereum;

module.exports = async function (truffle, network, accounts) {
  if (network === 'test' || network === 'soliditycoverage' || network === 'development') {
    console.log('Skipping deployment migration');
    return;
  }
  // eslint-disable-next-line global-require
  const { Deployment } = require('../scripts/deployment')(web3, Proxy);
  const deployment = new Deployment(truffle, network, accounts[0]);

  // Superuser private: a46e68b3f1881ca65ddb387b9e9baf28c3da1f6848d3f93cd206e51549453669
  // Superuser address: fffff2b5e1b308331b8548960347f9d874824f40
  // Deployer private: 8e1b9e2b156bc61d74482427f522842d8b1e6252b284da4d80fcbd95638d9ee9
  // Deployer address: dddddf4630b0ca1d7f18b681e61f5f40c0a4a652

  const superuser = 'fffff2b5e1b308331b8548960347f9d874824f40';
  const expectedDeployer = '0xDDddDf4630b0Ca1D7F18B681e61F5F40c0a4A652';
  let deployer;

  truffle.then(async () => {
    const networkName = network || 'ganache';
    if (network === 'ganache') {
      deployer = (await web3.eth.getAccounts())[0];
    } else {
      deployer = truffle.networks[networkName].from;
      assert.equal(accounts[0], expectedDeployer, 'Please, deploy using the above deployer address');
    }
    console.log('deployer address:', deployer);

    console.log('Deploying YALLTokenEthereum');
    const yallTokenEthereum = await deployment
      .factory(YALLTokenEthereum)
      .name('yallTokenEthereum')
      .arguments()
      .deploy();

    await yallTokenEthereum.setMinter(superuser);
    await yallTokenEthereum.transferOwnership(superuser);

    console.log('Saving addresses and abi to deployed folder...');

    deployment.save();
  });
};
