/*
 * Copyright ©️ 2018 Galt•Project Society Construction and Terraforming Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka)
 *
 * Copyright ©️ 2018 Galt•Core Blockchain Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka) by
 * [Basic Agreement](ipfs/QmaCiXUmSrP16Gz8Jdzq6AJESY1EAANmmwha15uR3c1bsS)).
 */

const YALExchange = artifacts.require('./YALExchange');
const Proxy = artifacts.require('./OwnedUpgradeabilityProxy');

const {web3} = YALExchange;
const fs = require('fs');
const _ = require('lodash');
const { ether, now } = require('@galtproject/solidity-test-chest')(web3);

YALExchange.numberFormat = 'String';


module.exports = async function(deployer, network, accounts) {
  if (network === 'test' || network === 'local_test' || network === 'development') {
    console.log('Skipping deployment migration');
    return;
  }

  deployer.then(async () => {
    const coreTeam = accounts[0];
    console.log('coreTeam', coreTeam);

    const data = JSON.parse(fs.readFileSync(`${__dirname}/../deployed/yalland_netconfig.json`).toString());
    console.log('Create contract instances...');
    const exchangeProxy = await deployer.deploy(Proxy);

    const exchangeImplementation = await deployer.deploy(YALExchange);

    const exchangeInitData = exchangeImplementation.contract.methods.initialize(
      // owner
      '0xf0430bbb78C3c359c22d4913484081A563B86170',
      data.yalDistributorAddress,
      data.coinTokenAddress,
      ether(19)
    ).encodeABI();
    await exchangeProxy.upgradeToAndCall(exchangeImplementation.address, exchangeInitData);

    const yalExchange = await YALExchange.at(exchangeProxy.address);

        // const distributor = await YALDistributor.at(data.yalDistributorAddress);
    // console.log('getTotalClaimed', await distributor.getTotalClaimed('0x648dbd33dc7098e7a2e0277fc592a6fc913059cd8ab0707367b82fa8a06aa13a'));
    console.log('calculateMaxYalToSell', await yalExchange.calculateMaxYalToSellByAddress('0xf0430bbb78C3c359c22d4913484081A563B86170'));

    console.log('Save addresses and abi to deployed folder...');

    await new Promise(resolve => {
      const deployDirectory = `${__dirname}/../deployed`;
      if (!fs.existsSync(deployDirectory)) {
        fs.mkdirSync(deployDirectory);
      }

      const deployFile = `${deployDirectory}/yalland_netconfig.json`;
      console.log(`saved to ${deployFile}`);

      fs.writeFile(
        deployFile,
        JSON.stringify(
          _.extend(data, {
            yalExchangeAddress: yalExchange.address,
            yalExchangeAbi: yalExchange.abi
          }),
          null,
          2
        ),
        resolve
      );
    });
  });
};
