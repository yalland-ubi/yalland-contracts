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

contract('Coin', ([deployer, alice, bob]) => {
    const baseAliceBalance = 10000000;
    const feePercent = 0.02;
    let coinToken;

    beforeEach(async function () {
        coinToken = await CoinToken.new({from: deployer});

        await coinToken.addRoleTo(deployer, "minter", {from: deployer});
        await coinToken.addRoleTo(deployer, "fee_manager", {from: deployer});
        await coinToken.mint(alice, Web3.utils.toWei(baseAliceBalance.toString(), 'ether'), {from: deployer});
        await coinToken.setTransferFee(Web3.utils.toWei(feePercent.toString(), 'szabo'), {from: deployer});
    });

    describe('#transfer()', () => {
        it('should correct transfer with fee', async function () {
            const transferCoinAmount = 1000;
            
            await coinToken.transfer(bob, Web3.utils.toWei(transferCoinAmount.toString(), 'ether'), {from: alice});
            
            let aliceBalance = await coinToken.balanceOf(alice);
            const expectedAliceBalance = baseAliceBalance - transferCoinAmount;
            assert.equal(Web3.utils.toWei(expectedAliceBalance.toString(), 'ether').toString(10), aliceBalance.toString(10));

            let bobBalance = await coinToken.balanceOf(bob);
            const expectedBobBalance = transferCoinAmount - transferCoinAmount / 100 * feePercent;
            assert.equal(Web3.utils.toWei(expectedBobBalance.toString(), 'ether').toString(10), bobBalance.toString(10));
            
            await coinToken.withdrawFee({from: deployer});
            
            let deployerBalance = await coinToken.balanceOf(deployer);
            const expectedDeployerBalance = transferCoinAmount / 100 * feePercent;
            assert.equal(Web3.utils.toWei(expectedDeployerBalance.toString(), 'ether').toString(10), deployerBalance.toString(10));
        });
    });
});
