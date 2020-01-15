/*
 * Copyright ©️ 2018 Galt•Project Society Construction and Terraforming Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka)
 *
 * Copyright ©️ 2018 Galt•Core Blockchain Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka) by
 * [Basic Agreement](ipfs/QmaCiXUmSrP16Gz8Jdzq6AJESY1EAANmmwha15uR3c1bsS)).
 */

const CoinToken = artifacts.require('./CoinToken.sol');
const City = artifacts.require('./City.sol');
const TariffAdder = artifacts.require('./TariffAdder.sol');

const pIteration = require('p-iteration');

const web3 = City.web3;
CoinToken.numberFormat = 'String';
City.numberFormat = 'String';
TariffAdder.numberFormat = 'String';

const {ether, evmIncreaseTime, assertRevert} = require('@galtproject/solidity-test-chest')(web3);


contract('TariffAdder', ([deployer, alice, bob, bob2, charlie, superuser, alice2, rateManager, joinManager]) => {
    const baseCityEthBalance = 1000000;
    const payByTariff = 100;
    const mintForPeriods = 10;
    const baseAliceBalance = 10000000;
    const feePercent = 0.00;
    let city;
    let coinToken;
    let tarifAdder;
    let coinTariffId;
    let ethTariffId;

    beforeEach(async function () {
        const payPeriod = 10;
        coinToken = await CoinToken.new("Coin token", "COIN", 18, {from: deployer});
        city = await City.new(10000, "City", "CT", {from: deployer});
        tarifAdder = await TariffAdder.new(city.address);

        await coinToken.mint(alice, ether(baseAliceBalance), {from: deployer});
        await coinToken.setTransferFee(web3.utils.toWei(feePercent.toString(), 'szabo'), {from: deployer});
        await web3.eth.sendTransaction({ from: alice, to: city.address, value: ether(baseCityEthBalance) });

        await city.addRoleTo(rateManager, await city.RATE_MANAGER_ROLE(), {from: deployer});
        await city.addRoleTo(joinManager, await city.MEMBER_JOIN_MANAGER_ROLE(), {from: deployer});
        await city.addRoleTo(tarifAdder.address, await city.MEMBER_JOIN_MANAGER_ROLE(), {from: deployer});
        await city.addRoleTo(tarifAdder.address, await city.MEMBER_LEAVE_MANAGER_ROLE(), {from: deployer});

        await coinToken.addRoleTo(city.address, await coinToken.MINTER_ROLE(), {from: deployer});
        await coinToken.addRoleTo(tarifAdder.address, await coinToken.MINTER_ROLE(), {from: deployer});
        await coinToken.addRoleTo(tarifAdder.address, await coinToken.BURNER_ROLE(), {from: deployer});

        await tarifAdder.addRoleTo(superuser, await tarifAdder.SUPERUSER_ROLE(), {from: deployer});

        const ethTariffResponse = await city.createTariff("Pay eth", ether(payByTariff), payPeriod.toString(), mintForPeriods.toString(), "0", '0x0000000000000000000000000000000000000000', {from: rateManager});
        ethTariffId = ethTariffResponse.logs[0].args.id;

        const coinTariffResponse = await city.createTariff("Pay coins", ether(payByTariff), payPeriod.toString(), mintForPeriods.toString(), "1", coinToken.address, {from: rateManager});
        coinTariffId = coinTariffResponse.logs[0].args.id;
    });

    describe('tariff adding', () => {
        it('Add users to coin and eth tariffs', async function () {
            await tarifAdder.migrateMultipleUserAddresses([alice, bob], coinTariffId, {from: superuser});
            await tarifAdder.migrateMultipleUserAddresses([alice, bob], ethTariffId, {from: superuser});

            await pIteration.forEach([coinTariffId, ethTariffId],  (tariffId) => {
                return pIteration.forEach([alice, bob], async (member) => {
                    const tariffParticipant = await city.getParticipantTariffInfo(member, tariffId);
                    assert.equal(tariffParticipant.active, true);
                });
            });

            assert.equal(await coinToken.balanceOf(alice), ether(baseAliceBalance + payByTariff));
            assert.equal(await coinToken.balanceOf(bob), ether(payByTariff));

            assert.equal(await coinToken.balanceOf(bob), ether(payByTariff));

            assert.equal(await web3.eth.getBalance(city.address), ether(baseCityEthBalance - payByTariff * 2));
        });
    });
});
