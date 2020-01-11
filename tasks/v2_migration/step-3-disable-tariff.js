const City = artifacts.require('./City');
const config = require('./config');

City.numberFormat = 'String';

module.exports = async function(callback) {
    try {
        const city = await City.at(config.cityAddress);
        console.log('Disabling tariff', config.tariffId, '...');
        await city.setTariffActive(config.tariffId, false);
        console.log('Tariff active flag:', (await city.getTariff(config.tariffId)).active);
    } catch (e) {
        console.log(e);
    }

    callback();
};
