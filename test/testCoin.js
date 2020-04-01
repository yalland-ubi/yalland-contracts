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
const YALDistributor = contract.fromArtifact('YALDistributor');

CoinToken.numberFormat = 'String';

const { ether, assertRevert, now, assertErc20BalanceChanged } = require('@galtproject/solidity-test-chest')(web3);
const { approveFunction, assertRelayedCall } = require('./helpers')(web3);

const keccak256 = web3.utils.soliditySha3;


describe.only('Coin', () => {
    const [pauser, alice, bob, charlie, dan, eve, verifier] = accounts;
    const deployer = defaultSender;

    let coinToken;
    let dist;
    const periodLength = 7 * 24 * 60 * 60;
    const periodVolume = ether(250 * 1000);
    const verifierRewardShare = ether(10);
    const baseAliceBalance = 10000000;
    const feePercent = 0.02;
    const startAfter = 10;
    const memberId1 = keccak256('bob');
    let genesisTimestamp;

    beforeEach(async function () {
        coinToken = await CoinToken.new(alice, "Coin token", "COIN", 18, {from: deployer});
        dist = await YALDistributor.new();
        genesisTimestamp = parseInt(await now(), 10) + startAfter;

        await dist.initialize(
            periodVolume,
            verifier,
            verifierRewardShare,

            coinToken.address,
            periodLength,
            genesisTimestamp
        );

        await coinToken.setDistributor(dist.address);
        await coinToken.mint(alice, ether(baseAliceBalance), {from: deployer});
        await coinToken.setTransferFee(ether(feePercent), {from: deployer});

        await dist.addMembersBeforeGenesis(
            [keccak256('foo'), keccak256('bar'), keccak256('bazz')],
            [alice, bob, charlie],
            { from: verifier }
            );
        // coinToken.contract.currentProvider.wrappedProvider.relayClient.approveFunction = approveFunction;

        // await deployRelayHub(web3);
        // await fundRecipient(web3, { recipient: coinToken.address, amount: ether(1) });
    });

    describe('#getFeeForAmount()', () => {
        it('should calculate fees correctly', async function() {
            await coinToken.setTransferFee(ether(0.02));
            assert.equal(await coinToken.getFeeForAmount(ether(1)), ether(0.0002));

            await coinToken.setTransferFee(ether(30));
            assert.equal(await coinToken.getFeeForAmount(ether(1)), ether(0.3));
        })

        it('should calculate negligible fees correctly', async function() {
            await coinToken.setTransferFee(ether(20));

            assert.equal(await coinToken.getFeeForAmount(10), 2);
            assert.equal(await coinToken.getFeeForAmount(8), 1);
            assert.equal(await coinToken.getFeeForAmount(5), 1);
            assert.equal(await coinToken.getFeeForAmount(4), 0);
            assert.equal(await coinToken.getFeeForAmount(1), 0);
        })

        it('should return 0 for 0 fee', async function() {
            await coinToken.setTransferFee(0);
            assert.equal(await coinToken.getFeeForAmount(ether(250)), 0);
            assert.equal(await coinToken.getFeeForAmount(0), 0);
        })
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

        describe('transfer restrictions', () => {
            // TODO: define YALDistributor
            it('should deny transferring if a from field is not active', async function() {

            });
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
            assertErc20BalanceChanged(bobBalanceBefore, bobBalanceAfter, ether(transferCoinAmount - (transferCoinAmount * feePercent / 100)));
            assertErc20BalanceChanged(contractBalanceBefore, contractBalanceAfter, ether(transferCoinAmount * feePercent / 100 ));

            const deployerBalanceBefore = await coinToken.balanceOf(deployer);
            await coinToken.withdrawFee({from: deployer});
            const deployerBalanceAfter = await coinToken.balanceOf(deployer);

            assertErc20BalanceChanged(deployerBalanceBefore, deployerBalanceAfter, ether(transferCoinAmount / 100 * feePercent));
        });
    });

    describe('#transfer()', () => {
        it.skip('should correct transfer with fee using GSN', async function () {
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
            assertErc20BalanceChanged(bobBalanaceBefore, bobBalanaceAfter, ether(transferCoinAmount - transferCoinAmount * feePercent / 100));
            assertErc20BalanceChanged(contractBalanceBefore, contractBalanceAfter, ether(transferCoinAmount * feePercent / 100));

            const deployerBalanceBefore = await coinToken.balanceOf(deployer);
            await coinToken.withdrawFee({from: deployer});
            const deployerBalanceAfter = await coinToken.balanceOf(deployer);

            assertErc20BalanceChanged(deployerBalanceBefore, deployerBalanceAfter, ether(transferCoinAmount / 100 * feePercent));
        });
    });
});
