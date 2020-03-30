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
const {
    deployRelayHub,
    fundRecipient,
} = require('@openzeppelin/gsn-helpers');

const CoinToken = contract.fromArtifact('CoinToken');

CoinToken.numberFormat = 'String';

const { ether, assertRevert, assertErc20BalanceChanged } = require('@galtproject/solidity-test-chest')(web3);
const { approveFunction, assertRelayedCall } = require('./helpers')(web3);


describe('Coin', () => {
    const [pauser, alice, bob, charlie] = accounts;
    const deployer = defaultSender;

    const baseAliceBalance = 10000000;
    const feePercent = 0.02;
    let coinToken;

    beforeEach(async function () {
        coinToken = await CoinToken.new("Coin token", "COIN", 18, {from: deployer});

        await coinToken.mint(alice, ether(baseAliceBalance), {from: deployer});
        await coinToken.setTransferFee(web3.utils.toWei(feePercent.toString(), 'szabo'), {from: deployer});

        coinToken.contract.currentProvider.wrappedProvider.relayClient.approveFunction = approveFunction;

        await deployRelayHub(web3);
        await fundRecipient(web3, { recipient: coinToken.address, amount: ether(1) });
    });

    describe('Pausable', () => {
        it('should deny transferring when paused', async function() {
            await coinToken.addRoleTo(pauser, await coinToken.PAUSER_ROLE(), { from: deployer });
            await coinToken.removeRoleFrom(deployer, await coinToken.PAUSER_ROLE(), { from: deployer });
            await assertRevert(coinToken.pause({ from: deployer }), 'Only pauser allowed');

            // approve before paused
            await coinToken.approve(bob, ether(10), { from: alice });
            await coinToken.pause({ from: pauser });
            await assertRevert(coinToken.transfer(bob, ether(1), { from: alice }), 'paused');
            await assertRevert(coinToken.transferFrom(alice, charlie, ether(1), { from: bob }), 'paused');
            await coinToken.unpause({ from: pauser });
            await coinToken.transfer(bob, ether(1), { from: alice });
            await coinToken.transferFrom(alice, charlie, ether(1), { from: bob });
        });
    });

    describe('#transferFrom()', () => {
        it.skip('should correct transfer with fee using GSN', async function () {
            const transferCoinAmount = 1000;

            const aliceBalanceBefore = await coinToken.balanceOf(alice);
            const bobBalanceBefore = await coinToken.balanceOf(bob);
            const contractBalanceBefore = await coinToken.balanceOf(coinToken.address);

            let res = await coinToken.approve(charlie, ether(transferCoinAmount), { from: alice, useGSN: true });
            assertRelayedCall(res);
            res = await coinToken.transferFrom(alice, bob, ether(transferCoinAmount / 2), {from: charlie, useGSN: true});
            assertRelayedCall(res);

            assert.equal(await coinToken.allowance(alice, charlie), ether(transferCoinAmount / 2));

            res = await coinToken.transferFrom(alice, bob, ether(transferCoinAmount / 2), {from: charlie, useGNS: true});
            assertRelayedCall(res);

            assert.equal(await coinToken.allowance(alice, charlie), 0);

            const aliceBalanaceAfter = await coinToken.balanceOf(alice);
            const bobBalanceAfter = await coinToken.balanceOf(bob);
            const contractBalanceAfter = await coinToken.balanceOf(coinToken.address);

            assertErc20BalanceChanged(aliceBalanceBefore, aliceBalanaceAfter, ether(-transferCoinAmount));
            assertErc20BalanceChanged(bobBalanceBefore, bobBalanceAfter, ether(transferCoinAmount - (transferCoinAmount / 100 * feePercent)));
            assertErc20BalanceChanged(contractBalanceBefore, contractBalanceAfter, ether(transferCoinAmount / 100 * feePercent));

            const deployerBalanceBefore = await coinToken.balanceOf(deployer);
            res = await coinToken.withdrawFee({from: deployer, useGSN: true});
            assertRelayedCall(res);
            const deployerBalanceAfter = await coinToken.balanceOf(deployer);

            assertErc20BalanceChanged(deployerBalanceBefore, deployerBalanceAfter, ether(transferCoinAmount / 100 * feePercent));
        });

        it('should correct transfer with fee', async function () {
            const transferCoinAmount = 1000;

            const aliceBalanceBefore = await coinToken.balanceOf(alice);
            const bobBalanceBefore = await coinToken.balanceOf(bob);
            const contractBalanceBefore = await coinToken.balanceOf(coinToken.address);

            await coinToken.approve(charlie, ether(transferCoinAmount), { from: alice });
            await coinToken.transferFrom(alice, bob, ether(transferCoinAmount / 2), {from: charlie});

            assert.equal(await coinToken.allowance(alice, charlie), ether(transferCoinAmount / 2));

            await coinToken.transferFrom(alice, bob, ether(transferCoinAmount / 2), {from: charlie});

            assert.equal(await coinToken.allowance(alice, charlie), 0);

            const aliceBalanaceAfter = await coinToken.balanceOf(alice);
            const bobBalanceAfter = await coinToken.balanceOf(bob);
            const contractBalanceAfter = await coinToken.balanceOf(coinToken.address);

            assertErc20BalanceChanged(aliceBalanceBefore, aliceBalanaceAfter, ether(-transferCoinAmount));
            assertErc20BalanceChanged(bobBalanceBefore, bobBalanceAfter, ether(transferCoinAmount - (transferCoinAmount / 100 * feePercent)));
            assertErc20BalanceChanged(contractBalanceBefore, contractBalanceAfter, ether(transferCoinAmount / 100 * feePercent));

            const deployerBalanceBefore = await coinToken.balanceOf(deployer);
            await coinToken.withdrawFee({from: deployer});
            const deployerBalanceAfter = await coinToken.balanceOf(deployer);

            assertErc20BalanceChanged(deployerBalanceBefore, deployerBalanceAfter, ether(transferCoinAmount / 100 * feePercent));
        });
    });

    describe('#transfer()', () => {
        it('should correct transfer with fee using GSN', async function () {
            const transferCoinAmount = 1000;

            const aliceBalanaceBefore = await coinToken.balanceOf(alice);
            const bobBalanaceBefore = await coinToken.balanceOf(bob);
            const contractBalanceBefore = await coinToken.balanceOf(coinToken.address);

            const { receipt } = await coinToken.transfer(bob, ether(transferCoinAmount), {from: alice, useGSN: true});
            assertRelayedCall(receipt);

            const aliceBalanaceAfter = await coinToken.balanceOf(alice);
            const bobBalanaceAfter = await coinToken.balanceOf(bob);
            const contractBalanceAfter = await coinToken.balanceOf(coinToken.address);

            assertErc20BalanceChanged(aliceBalanaceBefore, aliceBalanaceAfter, ether(-transferCoinAmount));
            assertErc20BalanceChanged(bobBalanaceBefore, bobBalanaceAfter, ether(transferCoinAmount - (transferCoinAmount / 100 * feePercent)));
            assertErc20BalanceChanged(contractBalanceBefore, contractBalanceAfter, ether(transferCoinAmount / 100 * feePercent));

            const deployerBalanceBefore = await coinToken.balanceOf(deployer);
            await coinToken.withdrawFee({from: deployer});
            const deployerBalanceAfter = await coinToken.balanceOf(deployer);

            assertErc20BalanceChanged(deployerBalanceBefore, deployerBalanceAfter, ether(transferCoinAmount / 100 * feePercent));
        });

        it('should correct transfer with fee', async function () {
            const transferCoinAmount = 1000;

            const aliceBalanaceBefore = await coinToken.balanceOf(alice);
            const bobBalanaceBefore = await coinToken.balanceOf(bob);
            const contractBalanceBefore = await coinToken.balanceOf(coinToken.address);

            await coinToken.transfer(bob, ether(transferCoinAmount), {from: alice});

            const aliceBalanaceAfter = await coinToken.balanceOf(alice);
            const bobBalanaceAfter = await coinToken.balanceOf(bob);
            const contractBalanceAfter = await coinToken.balanceOf(coinToken.address);

            assertErc20BalanceChanged(aliceBalanaceBefore, aliceBalanaceAfter, ether(-transferCoinAmount));
            assertErc20BalanceChanged(bobBalanaceBefore, bobBalanaceAfter, ether(transferCoinAmount - (transferCoinAmount / 100 * feePercent)));
            assertErc20BalanceChanged(contractBalanceBefore, contractBalanceAfter, ether(transferCoinAmount / 100 * feePercent));

            const deployerBalanceBefore = await coinToken.balanceOf(deployer);
            await coinToken.withdrawFee({from: deployer});
            const deployerBalanceAfter = await coinToken.balanceOf(deployer);

            assertErc20BalanceChanged(deployerBalanceBefore, deployerBalanceAfter, ether(transferCoinAmount / 100 * feePercent));
        });
    });
});
