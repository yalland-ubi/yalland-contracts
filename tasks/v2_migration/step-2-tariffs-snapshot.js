const City = artifacts.require('./City');
const config = require('./config');

City.numberFormat = 'String';

const fs = require('fs');

module.exports = async function(callback) {
    try {
        const city = await City.at(config.cityAddress);
        console.log('Total active member count', await city.getActiveParticipantsCount());
        console.log('Tariff active member count', await city.getTariffActiveParticipantsCount(config.tariffId));
        console.log('Dumping active members for tariff', config.tariffId, '...');
        const items = await city.getTariffActiveParticipants(config.tariffId);
        fs.writeFileSync('./tmp/active-tariff-members.json', JSON.stringify(items, null, 2));
        console.log('Dump saved to {project_root}/tmp/active-tariff-members.json');
        
        console.log('Dumping tariff configs');
        const tariff = await city.getTariff(config.tariffId);
        fs.writeFileSync('./tmp/old-tariff-config.json', JSON.stringify(tariff, null, 2));
        console.log('Dump saved to {project_root}/tmp/old-tariff-config.json');
    } catch (e) {
        console.log(e);
    }

    callback();
};
