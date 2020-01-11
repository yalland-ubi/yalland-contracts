const ERC20Pausable = artifacts.require('ERC20Pausable.sol');
const Ownable = artifacts.require('Ownable.sol');
const config = require('./config');

// TODO: transfer old token ownership to 0x7a90ac1969e5452DCb914b66f5a924493D0c64d7
module.exports = async function(callback) {
    try {
        const oldToken = await ERC20Pausable.at(config.oldTokenAddress);
        console.log('Pausing token contract...');
        console.log('Token owner is', await (await Ownable.at(config.oldTokenAddress)).owner());
        // NOTICE: not tested
        await oldToken.pause();
        console.log('Tariff pause flag:', await oldToken.paused());
    } catch (e) {
        console.log(e);
    }

    callback();
};
