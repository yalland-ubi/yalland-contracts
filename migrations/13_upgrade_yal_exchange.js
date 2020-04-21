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

    const exchangeProxy = await Proxy.at(data.yalExchangeAddress);

    const exchangeImplementation = await deployer.deploy(YALExchange);

    await exchangeProxy.upgradeTo(exchangeImplementation.address);

    const yalExchange = await YALExchange.at(exchangeProxy.address);

    console.log('calculateMaxYalToSell', await yalExchange.calculateMaxYalToSellByAddress('0xf0430bbb78C3c359c22d4913484081A563B86170'));
  });
};
