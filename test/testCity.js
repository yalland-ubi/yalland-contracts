/*
 * Copyright ©️ 2018 Galt•Project Society Construction and Terraforming Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka)
 *
 * Copyright ©️ 2018 Galt•Core Blockchain Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka) by
 * [Basic Agreement](ipfs/QmaCiXUmSrP16Gz8Jdzq6AJESY1EAANmmwha15uR3c1bsS)).
 */
const { accounts, defaultSender, contract, web3 } = require('@openzeppelin/test-environment');
const { assert } = require('chai');

const CoinToken = contract.fromArtifact('CoinToken');
const City = contract.fromArtifact('City');


describe('City', () => {
    const [alice, rateManager, joinManager, leaveManager] = accounts;
    const deployer = defaultSender;

    const payByTariff = web3.utils.toWei('10', 'ether');
    const mintForPeriods = 10;
    let coinToken;
    let city;

    beforeEach(async function () {
        coinToken = await CoinToken.new("Coin token", "COIN", 18, {from: deployer});
        city = await City.new(10000, "City", "CT", {from: deployer});

        await coinToken.addRoleTo(city.address, "minter", {from: deployer});
        await coinToken.addRoleTo(city.address, "burner", {from: deployer});
    });

    describe('#claimPayment()', () => {
        it('should allow claimPayment for new participants', async function () {
            const payPeriod = 1;

            await assertRevert(city.createTariff("Pay coins", payByTariff, payPeriod.toString(), mintForPeriods.toString(), "1", coinToken.address, {from: rateManager}));

            await city.addRoleTo(rateManager, await city.RATE_MANAGER_ROLE(), {from: deployer});
            
            const coinTariffResponse = await city.createTariff("Pay coins", payByTariff, payPeriod.toString(), mintForPeriods.toString(), "1", coinToken.address, {from: rateManager});
            const coinTariffId = coinTariffResponse.logs[0].args.id;

            const ethTariffResponse = await city.createTariff("Pay eth", payByTariff, payPeriod.toString(), mintForPeriods.toString(), "0", '0x0000000000000000000000000000000000000000', {from: rateManager});
            const ethTariffId = ethTariffResponse.logs[0].args.id;
            
            await assertRevert(city.addParticipation(alice, coinTariffId, {from: rateManager}));
            await assertRevert(city.addParticipation(alice, coinTariffId, {from: joinManager}));

            await city.addRoleTo(joinManager, await city.MEMBER_JOIN_MANAGER_ROLE(), {from: deployer});
            await city.addParticipation(alice, coinTariffId, {from: joinManager});
            assert.equal(await city.participants(alice), true);
            
            await city.addParticipation(alice, ethTariffId, {from: joinManager});

            let aliceInfo = await city.getParticipantTariffInfo(alice, coinTariffId);
            assert.equal(aliceInfo[0], true);
            assert.equal(aliceInfo[2].toString(10), web3.utils.toWei('100', 'ether').toString(10));

            await city.claimPayment(alice, coinTariffId, 1);
            let aliceBalance = await coinToken.balanceOf(alice);
            assert.equal(aliceBalance.toString(10), payByTariff.toString(10));

            let contractBalance = await coinToken.balanceOf(city.address);
            assert.equal(contractBalance.toString(10), web3.utils.toWei('90', 'ether').toString(10));

            await waitSeconds(payPeriod);

            await city.claimPayment(alice, coinTariffId, 1);

            await waitSeconds(payPeriod * 2);

            await city.claimPayment(alice, coinTariffId, 2);

            aliceBalance = await coinToken.balanceOf(alice);
            assert.equal(aliceBalance.toString(10), web3.utils.toWei('40', 'ether').toString(10));

            contractBalance = await coinToken.balanceOf(city.address);
            assert.equal(contractBalance.toString(10), web3.utils.toWei('60', 'ether').toString(10));

            aliceInfo = await city.getParticipantTariffInfo(alice, coinTariffId);
            assert.equal(aliceInfo[1].toString(10), web3.utils.toWei('40', 'ether').toString(10));
            assert.equal(aliceInfo[2].toString(10), web3.utils.toWei('100', 'ether').toString(10));

            await assertRevert(city.kickAllParticipation(alice, {from: joinManager}));
            await assertRevert(city.kickAllParticipation(alice, {from: rateManager}));
            await assertRevert(city.kickAllParticipation(alice, {from: leaveManager}));

            await city.addRoleTo(leaveManager, await city.MEMBER_LEAVE_MANAGER_ROLE(), {from: deployer});
            await city.kickAllParticipation(alice, {from: leaveManager});
            assert.equal(await city.participants(alice), false);
            aliceInfo = await city.getParticipantTariffInfo(alice, coinTariffId);
            assert.equal(aliceInfo[0], false);

            await waitSeconds(payPeriod * 2);

            await assertRevert(city.claimPayment(alice, coinTariffId, 1));
            
            contractBalance = await coinToken.balanceOf(city.address);
            assert.equal(contractBalance.toString(10), web3.utils.toWei('0', 'ether').toString(10));
            
            await city.addParticipation(alice, coinTariffId, {from: joinManager});
            assert.equal(await city.participants(alice), true);
            aliceInfo = await city.getParticipantTariffInfo(alice, coinTariffId);
            assert.equal(aliceInfo[0], true);

            await city.kickAllParticipation(alice, {from: leaveManager});
            await city.addParticipation(alice, coinTariffId, {from: joinManager});
        });
        
        it('should disallow claimPayment if period not over', async function () {
            const payPeriod = 60;

            const coinTariffResponse = await city.createTariff("Pay coins", payByTariff, payPeriod.toString(), mintForPeriods.toString(), "1", coinToken.address, {from: deployer});
            const coinTariffId = coinTariffResponse.logs[0].args.id;

            await city.addParticipation(alice, coinTariffId);

            await city.claimPayment(alice, coinTariffId, 1);
            await assertRevert(city.claimPayment(alice, coinTariffId, 1));
        });
    });
});

async function waitSeconds(seconds) {
    return await new Promise((resolve, reject) => {
        setTimeout(() => {
            resolve();
        }, 1000 * seconds)
    });
}
async function assertRevert(promise) {
    try {
        await promise;
    } catch (error) {
        const revert = error.message.search('revert') >= 0;
        assert(revert, `Expected throw, got '${error}' instead`);
        return;
    }
    assert.fail('Expected throw not received');
}
