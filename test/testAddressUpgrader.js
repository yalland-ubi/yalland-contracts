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
const AddressUpgrader = artifacts.require('./AddressUpgrader.sol');

const web3 = City.web3;
CoinToken.numberFormat = 'String';
City.numberFormat = 'String';
AddressUpgrader.numberFormat = 'String';

const {ether, evmIncreaseTime, assertRevert} = require('@galtproject/solidity-test-chest')(web3);


contract('AddressUpgrader', ([deployer, alice, bob, superuser, alice2, rateManager, joinManager]) => {
    const payByTariff = web3.utils.toWei('10', 'ether');
    const mintForPeriods = 10;
    const baseAliceBalance = 10000000;
    const feePercent = 0.02;
    let city;
    let coinToken;
    let addressUpgrader;
    let coinTariffId;
    let ethTariffId;

    beforeEach(async function () {
        const payPeriod = 10;
        coinToken = await CoinToken.new("Coin token", "COIN", 18, {from: deployer});
        city = await City.new(10000, "City", "CT", {from: deployer});
        addressUpgrader = await AddressUpgrader.new(city.address, coinToken.address);

        await coinToken.mint(alice, ether(baseAliceBalance), {from: deployer});
        await coinToken.setTransferFee(web3.utils.toWei(feePercent.toString(), 'szabo'), {from: deployer});
        await web3.eth.sendTransaction({ from: alice, to: city.address, value: ether(100) });

        await city.addRoleTo(rateManager, await city.RATE_MANAGER_ROLE(), {from: deployer});
        await city.addRoleTo(joinManager, await city.MEMBER_JOIN_MANAGER_ROLE(), {from: deployer});
        await city.addRoleTo(addressUpgrader.address, await city.MEMBER_JOIN_MANAGER_ROLE(), {from: deployer});
        await city.addRoleTo(addressUpgrader.address, await city.MEMBER_LEAVE_MANAGER_ROLE(), {from: deployer});

        await coinToken.addRoleTo(city.address, await coinToken.MINTER_ROLE(), {from: deployer});
        await coinToken.addRoleTo(addressUpgrader.address, await coinToken.MINTER_ROLE(), {from: deployer});
        await coinToken.addRoleTo(addressUpgrader.address, await coinToken.BURNER_ROLE(), {from: deployer});

        await addressUpgrader.addRoleTo(superuser, await addressUpgrader.SUPERUSER_ROLE(), {from: deployer});

        const ethTariffResponse = await city.createTariff("Pay eth", payByTariff, payPeriod.toString(), mintForPeriods.toString(), "0", '0x0000000000000000000000000000000000000000', {from: rateManager});
        ethTariffId = ethTariffResponse.logs[0].args.id;

        const coinTariffResponse = await city.createTariff("Pay coins", payByTariff, payPeriod.toString(), mintForPeriods.toString(), "1", coinToken.address, {from: rateManager});
        coinTariffId = coinTariffResponse.logs[0].args.id;

        await city.addParticipation(alice, coinTariffId, {from: joinManager});
        await city.addParticipation(alice, ethTariffId, {from: joinManager});

        await city.addParticipation(bob, coinTariffId, {from: joinManager});
        await city.addParticipation(bob, ethTariffId, {from: joinManager});

        await evmIncreaseTime(21);
        await city.claimPayment(alice, coinTariffId, 3);
        await city.claimPayment(alice, ethTariffId, 3);
    });

    describe('user migration', () => {
        it('allow a user migrating his address', async function () {
            // migrate too early
            await assertRevert(addressUpgrader.migrateMyAddress(alice2, coinTariffId, {from: alice}), 'Can migrate only at non-claimed yet period');
            await assertRevert(addressUpgrader.migrateMyAddress(alice2, ethTariffId, {from: alice}), 'Can migrate only at non-claimed yet period');

            await evmIncreaseTime(10);

            // migrate
            await addressUpgrader.migrateMyAddress(alice2, coinTariffId, {from: alice});
            await addressUpgrader.migrateMyAddress(alice2, ethTariffId, {from: alice});

            // already migrated
            await assertRevert(addressUpgrader.migrateMyAddress(alice2, coinTariffId, {from: alice}), 'Not participant');
            await assertRevert(addressUpgrader.migrateMyAddress(alice2, ethTariffId, {from: alice}), 'Not participant');

            await evmIncreaseTime(10);

            await assertRevert(city.claimPayment(alice, coinTariffId, 1), "Tariff payment is not active");
            await assertRevert(city.claimPayment(alice, ethTariffId, 1), "Tariff payment is not active");
            await city.claimPayment(alice2, coinTariffId, 2);
            await city.claimPayment(alice2, ethTariffId, 2);
            await assertRevert(city.claimPayment(alice2, coinTariffId, 1), "Too soon");
            await assertRevert(city.claimPayment(alice2, ethTariffId, 1), "Too soon");
        });

        it('allow manager migrating a user', async function () {
            // unauthorized superuser
            await assertRevert(addressUpgrader.migrateUserAddress(alice, alice2, coinTariffId, {from: alice}), 'Only superuser allowed');

            // migrate too early
            await assertRevert(addressUpgrader.migrateUserAddress(alice, alice2, coinTariffId, {from: superuser}), 'Can migrate only at non-claimed yet period');
            await assertRevert(addressUpgrader.migrateUserAddress(alice, alice2, ethTariffId, {from: superuser}), 'Can migrate only at non-claimed yet period');

            await evmIncreaseTime(10);

            // migrate
            await addressUpgrader.migrateUserAddress(alice, alice2, coinTariffId, {from: superuser});
            await addressUpgrader.migrateUserAddress(alice, alice2, ethTariffId, {from: superuser});

            // already migrated
            await assertRevert(addressUpgrader.migrateUserAddress(alice, alice2, coinTariffId, {from: superuser}), 'Not participant');
            await assertRevert(addressUpgrader.migrateUserAddress(alice, alice2, ethTariffId, {from: superuser}), 'Not participant');

            await evmIncreaseTime(10);

            await assertRevert(city.claimPayment(alice, coinTariffId, 1), "Tariff payment is not active");
            await assertRevert(city.claimPayment(alice, ethTariffId, 1), "Tariff payment is not active");
            await city.claimPayment(alice2, coinTariffId, 2);
            await city.claimPayment(alice2, ethTariffId, 2);
            await assertRevert(city.claimPayment(alice2, coinTariffId, 1), "Too soon");
            await assertRevert(city.claimPayment(alice2, ethTariffId, 1), "Too soon");
        });
    });
});
