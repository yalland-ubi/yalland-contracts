const CoinToken = artifacts.require('./CoinToken.sol');
const City = artifacts.require('./City.sol');
const Web3 = require('web3');
const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
const chaiBigNumber = require('chai-bignumber')(Web3.utils.BN);

const web3 = new Web3(City.web3.currentProvider);

// TODO: move to helpers
Web3.utils.BN.prototype.equal = Web3.utils.BN.prototype.eq;
Web3.utils.BN.prototype.equals = Web3.utils.BN.prototype.eq;

chai.use(chaiAsPromised);
chai.use(chaiBigNumber);
chai.should();

contract('City', ([deployer, alice, bob]) => {
    const payByTariff = Web3.utils.toWei('10', 'ether');
    let coinToken;
    let city;

    beforeEach(async function () {
        coinToken = await CoinToken.new({from: deployer});
        city = await City.new(10000, "City", "CT", {from: deployer});

        await coinToken.addRoleTo(deployer, "minter", {from: deployer});
        await coinToken.mint(city.address, Web3.utils.toWei('10000000', 'ether'), {from: deployer});
    });

    describe('#claimPayment()', () => {
        it('should allow claimPayment for new participants', async function () {
            const payPeriod = 1;

            const coinTariffResponse = await city.createTariff("Pay coins", payByTariff, payPeriod.toString(), "1", coinToken.address, {from: deployer});
            const coinTariffId = coinTariffResponse.logs[0].args.id;

            await city.addParticipation(alice, coinTariffId);
            
            await city.claimPayment(alice, 1);
            let aliceBalance = await coinToken.balanceOf(alice);
            assert.equal(aliceBalance.toString(10), payByTariff.toString(10))
            
            await waitSeconds(payPeriod);
            
            await city.claimPayment(alice, 1);

            await waitSeconds(payPeriod * 2);

            await city.claimPayment(alice, 2);
            
            aliceBalance = await coinToken.balanceOf(alice);
            assert.equal(aliceBalance.toString(10), Web3.utils.toWei('40', 'ether').toString(10));
        });
        
        it('should disallow claimPayment if period not over', async function () {
            const payPeriod = 60;

            const coinTariffResponse = await city.createTariff("Pay coins", payByTariff, payPeriod.toString(), "1", coinToken.address, {from: deployer});
            const coinTariffId = coinTariffResponse.logs[0].args.id;

            await city.addParticipation(alice, coinTariffId);

            await city.claimPayment(alice, 1);
            await assertRevert(city.claimPayment(alice, 1));
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
