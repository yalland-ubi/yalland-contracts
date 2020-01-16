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


contract('AddressUpgrader', ([deployer, alice, bob, bob2, charlie, superuser, alice2, rateManager, joinManager]) => {
    const payByTariff = web3.utils.toWei('10', 'ether');
    const mintForPeriods = 10;
    const baseAliceBalance = 10000000;
    const feePercent = 0.00;
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
        await city.claimPayment(bob, coinTariffId, 3);
        await city.claimPayment(bob, ethTariffId, 3);
    });

    describe('user migration', () => {
        it('insufficient funds migration from user', async function () {
            await coinToken.transfer(charlie, ether(21), { from: bob });
            assert.equal(await coinToken.balanceOf(bob), ether(9));

            await evmIncreaseTime(10);

            await city.claimPayment(bob, coinTariffId, 1);

            // migrate
            await addressUpgrader.migrateMyAddress(bob2, coinTariffId, {from: bob});
            await addressUpgrader.migrateMyAddress(bob2, ethTariffId, {from: bob});

            // already migrated
            // transfer some funds to check the error message
            await coinToken.transfer(bob, ether(100), { from: alice });

            // does nothing
            await addressUpgrader.migrateMyAddress(bob2, coinTariffId, {from: bob});
            await addressUpgrader.migrateMyAddress(bob2, ethTariffId, {from: bob});

            await evmIncreaseTime(10);

            await assertRevert(city.claimPayment(bob, coinTariffId, 1), "Tariff payment is not active");
            await assertRevert(city.claimPayment(bob, ethTariffId, 1), "Tariff payment is not active");
            await city.claimPayment(bob2, coinTariffId, 1);
            await city.claimPayment(bob2, ethTariffId, 2);
            await assertRevert(city.claimPayment(bob2, coinTariffId, 1), "Too soon");
            await assertRevert(city.claimPayment(bob2, ethTariffId, 2), "Too soon");
        });

        it('allow a user migrating with sufficient funds', async function () {
            // migrate
            await addressUpgrader.migrateMyAddress(bob2, coinTariffId, {from: bob});
            await addressUpgrader.migrateMyAddress(bob2, ethTariffId, {from: bob});

            // already migrated
            await assertRevert(addressUpgrader.migrateMyAddress(bob2, coinTariffId, {from: bob}), 'Cant migrate 0 balance');
            // does nothing
            await addressUpgrader.migrateMyAddress(bob2, ethTariffId, {from: bob});

            await evmIncreaseTime(10);

            await assertRevert(city.claimPayment(bob, coinTariffId, 1), "Tariff payment is not active");
            await assertRevert(city.claimPayment(bob, ethTariffId, 1), "Tariff payment is not active");
            await city.claimPayment(bob2, coinTariffId, 1);
            await city.claimPayment(bob2, ethTariffId, 2);
            await assertRevert(city.claimPayment(bob2, coinTariffId, 1), "Too soon");
            await assertRevert(city.claimPayment(bob2, ethTariffId, 1), "Too soon");
        });

        it('allow manager migrating a user', async function () {
            // migrate
            await addressUpgrader.migrateUserAddress(bob, bob2, coinTariffId, {from: superuser});
            await addressUpgrader.migrateUserAddress(bob, bob2, ethTariffId, {from: superuser});

            // already migrated
            await assertRevert(addressUpgrader.migrateUserAddress(bob, bob2, coinTariffId, {from: superuser}), 'Cant migrate 0 balance');
            // does nothing
            await addressUpgrader.migrateUserAddress(bob, bob2, ethTariffId, {from: superuser});

            await evmIncreaseTime(10);

            await assertRevert(city.claimPayment(bob, coinTariffId, 1), "Tariff payment is not active");
            await assertRevert(city.claimPayment(bob, ethTariffId, 1), "Tariff payment is not active");
            await city.claimPayment(bob2, coinTariffId, 1);
            await city.claimPayment(bob2, ethTariffId, 2);
            await assertRevert(city.claimPayment(bob2, coinTariffId, 1), "Too soon");
            await assertRevert(city.claimPayment(bob2, ethTariffId, 1), "Too soon");
        });

        it('allow manager migrating multiple users', async function () {
            // migrate
            await addressUpgrader.migrateMultipleUserAddresses([alice, bob], [alice2, bob2], coinTariffId, {from: superuser});
            await addressUpgrader.migrateMultipleUserAddresses([alice, bob], [alice2, bob2], ethTariffId, {from: superuser});

            await evmIncreaseTime(10);

            await assertRevert(city.claimPayment(alice, coinTariffId, 1), "Tariff payment is not active");
            await assertRevert(city.claimPayment(alice, ethTariffId, 1), "Tariff payment is not active");
            await assertRevert(city.claimPayment(bob, coinTariffId, 1), "Tariff payment is not active");
            await assertRevert(city.claimPayment(bob, ethTariffId, 1), "Tariff payment is not active");
            await city.claimPayment(alice2, coinTariffId, 1);
            await city.claimPayment(alice2, ethTariffId, 2);
            await city.claimPayment(bob2, coinTariffId, 1);
            await city.claimPayment(bob2, ethTariffId, 2);
            await assertRevert(city.claimPayment(alice2, coinTariffId, 1), "Too soon");
            await assertRevert(city.claimPayment(alice2, ethTariffId, 1), "Too soon");
            await assertRevert(city.claimPayment(bob2, coinTariffId, 1), "Too soon");
            await assertRevert(city.claimPayment(bob2, ethTariffId, 1), "Too soon");
        });

        it('allow manager migrating a user which is not included into a tariff', async function () {
            await coinToken.transfer(charlie, ether(42), { from: alice });
            assert.equal(await coinToken.balanceOf(charlie), ether(42));

            // migrate
            await addressUpgrader.migrateUserAddress(charlie, bob2, coinTariffId, {from: superuser});
            // this one does nothing
            await addressUpgrader.migrateUserAddress(charlie, bob2, ethTariffId, {from: superuser});

            await assertRevert(city.claimPayment(bob2, coinTariffId, 1), "Tariff payment is not active");
            await assertRevert(city.claimPayment(bob2, ethTariffId, 1), "Tariff payment is not active");
        });
    });
});
