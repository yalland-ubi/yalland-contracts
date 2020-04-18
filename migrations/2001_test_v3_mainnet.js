/*
 * Copyright ©️ 2018 Galt•Project Society Construction and Terraforming Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka)
 *
 * Copyright ©️ 2018 Galt•Core Blockchain Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka) by
 * [Basic Agreement](ipfs/QmaCiXUmSrP16Gz8Jdzq6AJESY1EAANmmwha15uR3c1bsS)).
 */

const fs = require('fs');
const _ = require('lodash');

const YALLTokenEthereum = artifacts.require('./YALLTokenEthereum');
const { web3 } = YALLTokenEthereum;

module.exports = async function (truffle, network, accounts) {
    // if (network === 'test' || network === 'local_test' || network === 'development') {
    //     console.log('Skipping deployment migration');
    //     return;
    // }
    const data = JSON.parse(fs.readFileSync(`${__dirname}/../deployed/${network}.json`).toString());

    // Superuser private: a46e68b3f1881ca65ddb387b9e9baf28c3da1f6848d3f93cd206e51549453669
    // Superuser address: fffff2b5e1b308331b8548960347f9d874824f40

    const superuser = 'fffff2b5e1b308331b8548960347f9d874824f40';
    truffle.then(async () => {
        let deployer;
        if (network === 'ganache') {
            deployer = (await web3.eth.getAccounts())[0]
        } else {
            deployer = truffle.networks[network].from;
        }
        console.log('deployer address:', deployer);

        console.log('Deploying YALLTokenEthereum');
        const yallTokenEthereum = await truffle.deploy(YALLTokenEthereum);

        await yallTokenEthereum.setMinter(superuser);
        await yallTokenEthereum.transferOwnership(superuser);

        console.log('Saving addresses and abi to deployed folder...');
        await new Promise(resolve => {
            const deployDirectory = `${__dirname}/../deployed`;
            if (!fs.existsSync(deployDirectory)) {
                fs.mkdirSync(deployDirectory);
            }

            const deployFile = `${deployDirectory}/${network}.json`;
            console.log(`saved to ${deployFile}`);

            fs.writeFile(
                deployFile,
                JSON.stringify(
                    _.extend(data, {
                        yallTokenEthereumAddress: yallTokenEthereum.address,
                        yallTokenEthereumAbi: yallTokenEthereum.abi
                    }),
                    null,
                    2
                ),
                resolve
            );
        });
    });
};
