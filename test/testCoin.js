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
const { BigNumber } = require('bignumber.js');
const {
    deployRelayHub,
    fundRecipient,
} = require('@openzeppelin/gsn-helpers');

const CoinToken = contract.fromArtifact('CoinToken');
const YALDistributor = contract.fromArtifact('YALDistributor');

CoinToken.numberFormat = 'String';

const { ether, increaseTime, assertRevert, now, assertErc20BalanceChanged } = require('@galtproject/solidity-test-chest')(web3);
const { approveFunction, assertRelayedCall } = require('./helpers')(web3);

const keccak256 = web3.utils.soliditySha3;


describe('Coin', () => {
    const [pauser, alice, bob, charlie, dan, eve, verifier, transfer_wl_manager] = accounts;
    const deployer = defaultSender;

    let coinToken;
    let dist;
    const periodLength = 7 * 24 * 60 * 60;
    const periodVolume = ether(250 * 1000);
    const verifierRewardShare = ether(10);
    const baseAliceBalance = 10000000;
    const feePercent = 0.02;
    const opsFee = new BigNumber(0.7);
    const startAfter = 10;
    const memberId1 = keccak256('bob');
    let genesisTimestamp;

    before(async function() {
        dist = await YALDistributor.new();
        dist.contract.currentProvider.wrappedProvider.relayClient.approveFunction = approveFunction;

    });

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

        await coinToken.addRoleTo(dist.address, 'minter');
        await coinToken.addRoleTo(transfer_wl_manager, 'transfer_wl_manager');
        // await coinToken.addRoleTo(feeManager, 'fee_manager');

        await coinToken.setDistributor(dist.address);
        await coinToken.mint(alice, ether(baseAliceBalance), {from: deployer});
        await coinToken.setTransferFee(ether(feePercent), {from: deployer});
        await coinToken.setOpsFee(ether(opsFee), {from: deployer});

        await dist.addMembersBeforeGenesis(
            [keccak256('foo'), keccak256('bar'), keccak256('bazz')],
            [alice, bob, charlie],
            { from: verifier }
            );
        await increaseTime(20);

        coinToken.contract.currentProvider.wrappedProvider.relayClient.approveFunction = approveFunction;

        await deployRelayHub(web3);
        await fundRecipient(web3, { recipient: dist.address, amount: ether(1) });
        await fundRecipient(web3, { recipient: coinToken.address, amount: ether(1) });
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
            await assertRevert(coinToken.transferWithMemo(bob, ether(1), 'hey', { from: alice }), 'paused');
            await assertRevert(coinToken.transferFrom(alice, charlie, ether(1), { from: bob }), 'paused');
            await assertRevert(coinToken.approve(alice, ether(1), { from: bob }), 'paused');

            await coinToken.unpause({ from: pauser });

            await coinToken.transfer(bob, ether(1), { from: alice });
            await coinToken.transferWithMemo(bob, ether(1), 'hey', { from: alice });
            await coinToken.transferFrom(alice, charlie, ether(1), { from: bob });
            await coinToken.approve(bob, ether(10), { from: alice });
        });
    });

    describe('#isMemberValid()', () => {
        it('should return false for inactive member', async function() {
            assert.equal(await coinToken.isMemberValid(dan), false);
        });

        it('should return true if the address is inside YALDistributor active list', async function() {
            await dist.addMember(keccak256('dan'), dan, { from: verifier });
            assert.equal(await coinToken.isMemberValid(dan), true);
        });

        it('should return true if the address is inside coin token whitelist', async function() {
            await coinToken.setWhitelistAddress(dan, true, { from: transfer_wl_manager });
            assert.equal(await coinToken.isMemberValid(dan), true);
        });
    });

    describe('#SetWhitelistAddress()', () => {
        it('should deny non wl manager calling the method', async function() {
            await assertRevert(
                coinToken.setWhitelistAddress(dan, true, { from: defaultSender }),
                'Only transfer_wl_manager allowed.'
            );
        });

        it('should change wl value', async function() {
            assert.equal(await coinToken.opsWhitelist(dan), false);
            await coinToken.setWhitelistAddress(dan, true, { from: transfer_wl_manager });
            assert.equal(await coinToken.opsWhitelist(dan), true);
            await coinToken.setWhitelistAddress(dan, false, { from: transfer_wl_manager });
            assert.equal(await coinToken.opsWhitelist(dan), false);
        });
    });

    describe('#approve()', () => {
        describe('approve restrictions', () => {
            it('should deny approving if the approver is inactive', async function() {
                await dist.disableMembers([alice], { from: verifier });
                await assertRevert(coinToken.approve(bob, ether(1), { from: alice }), 'Member is invalid');
            });

            it('should deny approving if the receiver is inactive', async function() {
                await dist.disableMembers([bob], { from: verifier });
                await assertRevert(coinToken.approve(bob, ether(1), { from: alice }), 'Member is invalid');
            });

            it('should allow approving when both approver and receiver are active', async function() {
                await coinToken.approve(charlie, ether(1), { from: alice });
            });
        });

        it('should correctly approve with fee using GSN', async function () {
            const transferCoinAmount = 1000;

            const aliceBalanceBefore = await coinToken.balanceOf(alice);
            const bobBalanceBefore = await coinToken.balanceOf(bob);
            const contractBalanceBefore = await coinToken.balanceOf(coinToken.address);

            let res = await coinToken.approve(charlie, ether(transferCoinAmount), { from: alice, useGSN: true });
            assertRelayedCall(res);

            const aliceBalanaceAfter = await coinToken.balanceOf(alice);
            const bobBalanceAfter = await coinToken.balanceOf(bob);
            const contractBalanceAfter = await coinToken.balanceOf(coinToken.address);

            assertErc20BalanceChanged(aliceBalanceBefore, aliceBalanaceAfter, ether(-opsFee));
            assertErc20BalanceChanged(bobBalanceBefore, bobBalanceAfter, '0');
            assertErc20BalanceChanged(contractBalanceBefore, contractBalanceAfter, ether(opsFee));
        });

        it('should charge on each approval which uses GSN', async function () {
            const transferCoinAmount = 1000;

            const aliceBalanceBefore = await coinToken.balanceOf(alice);
            const bobBalanceBefore = await coinToken.balanceOf(bob);
            const contractBalanceBefore = await coinToken.balanceOf(coinToken.address);

            await coinToken.approve(charlie, ether(transferCoinAmount), { from: alice, useGSN: true });
            await coinToken.approve(charlie, ether(2 * transferCoinAmount), { from: alice, useGSN: true });
            await coinToken.approve(charlie, ether(0), { from: alice, useGSN: true });

            const aliceBalanaceAfter = await coinToken.balanceOf(alice);
            const bobBalanceAfter = await coinToken.balanceOf(bob);
            const contractBalanceAfter = await coinToken.balanceOf(coinToken.address);

            assertErc20BalanceChanged(aliceBalanceBefore, aliceBalanaceAfter, ether(- (opsFee.multipliedBy(3))));
            assertErc20BalanceChanged(bobBalanceBefore, bobBalanceAfter, '0');
            assertErc20BalanceChanged(contractBalanceBefore, contractBalanceAfter, ether(opsFee.multipliedBy(3)));
        });
    });

    describe('#transferFrom()', () => {
        describe('transfer restrictions', () => {
            it('should deny transferring if a from address is not active', async function() {
                await coinToken.approve(charlie, ether(1), { from: alice });
                await dist.disableMembers([alice], { from: verifier });
                await assertRevert(coinToken.transferFrom(alice, bob, ether(1), { from: charlie }), 'Member is invalid');
            });

            it('should deny transferring if a to address is not active', async function() {
                await coinToken.approve(charlie, ether(1), { from: alice });
                await dist.disableMembers([bob], { from: verifier });
                await assertRevert(coinToken.transferFrom(alice, bob, ether(1), { from: charlie }), 'Member is invalid');
            });

            it('should deny transferring if a tx sender is not active', async function() {
                await coinToken.approve(charlie, ether(1), { from: alice });
                await dist.disableMembers([charlie], { from: verifier });
                await assertRevert(coinToken.transferFrom(alice, bob, ether(1), { from: charlie }), 'Member is invalid');
            });

            it('should allow transferring all from, to and tx sender are active', async function() {
                await coinToken.approve(charlie, ether(1), { from: alice });
                await coinToken.transferFrom(alice, bob, ether(1), { from: charlie });
            });
        });

        it('should correct transfer with fee using GSN', async function () {
            await coinToken.mint(charlie, ether(baseAliceBalance), {from: deployer});
            const transferCoinAmount = 1000;

            const aliceBalanceBefore = await coinToken.balanceOf(alice);
            const bobBalanceBefore = await coinToken.balanceOf(bob);
            const charlieBalanceBefore = await coinToken.balanceOf(charlie);
            const contractBalanceBefore = await coinToken.balanceOf(coinToken.address);

            await coinToken.approve(charlie, ether(transferCoinAmount), { from: alice });
            let res = await coinToken.transferFrom(alice, bob, ether(transferCoinAmount / 2), {from: charlie, useGSN: true});
            assertRelayedCall(res);

            assert.equal(await coinToken.allowance(alice, charlie), ether(transferCoinAmount / 2));

            res = await coinToken.transferFrom(alice, bob, ether(transferCoinAmount / 4), {from: charlie, useGSN: true});
            assertRelayedCall(res);

            res = await coinToken.transferFrom(alice, bob, ether(transferCoinAmount / 4), {from: charlie, useGSN: true});
            assertRelayedCall(res);

            assert.equal(await coinToken.allowance(alice, charlie), 0);

            const aliceBalanaceAfter = await coinToken.balanceOf(alice);
            const bobBalanceAfter = await coinToken.balanceOf(bob);
            const charlieBalanceAfter = await coinToken.balanceOf(charlie);
            const contractBalanceAfter = await coinToken.balanceOf(coinToken.address);

            const bothFees = opsFee.multipliedBy(3).plus(transferCoinAmount * feePercent / 100);

            assertErc20BalanceChanged(aliceBalanceBefore, aliceBalanaceAfter, ether(-transferCoinAmount));
            assertErc20BalanceChanged(bobBalanceBefore, bobBalanceAfter, ether(transferCoinAmount - (transferCoinAmount / 100 * feePercent)));
            assertErc20BalanceChanged(charlieBalanceBefore, charlieBalanceAfter, ether(-opsFee.multipliedBy(3)));
            assertErc20BalanceChanged(contractBalanceBefore, contractBalanceAfter, ether(bothFees));

            const deployerBalanceBefore = await coinToken.balanceOf(deployer);
            await coinToken.withdrawFee({ from: deployer });
            const deployerBalanceAfter = await coinToken.balanceOf(deployer);

            assertErc20BalanceChanged(deployerBalanceBefore, deployerBalanceAfter, ether(bothFees));
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
        describe('transfer restrictions', () => {
            it('should deny transfer if the sender is inactive', async function() {
                await dist.disableMembers([alice], { from: verifier });
                await assertRevert(coinToken.transfer(bob, ether(1), { from: alice }), 'Member is invalid');
            });
            it('should deny transfer if the receiver is inactive', async function() {
                await dist.disableMembers([bob], { from: verifier });
                await assertRevert(coinToken.transfer(bob, ether(1), { from: alice }), 'Member is invalid');
            });

            it('should allow transfer when both sender and receiver are active', async function() {
                await coinToken.transfer(charlie, ether(1), { from: alice });
            });
        });

        it('should correct transfer with fee using GSN', async function () {
            const transferCoinAmount = 1000;

            const aliceBalanaceBefore = await coinToken.balanceOf(alice);
            const bobBalanaceBefore = await coinToken.balanceOf(bob);
            const contractBalanceBefore = await coinToken.balanceOf(coinToken.address);

            const res = await coinToken.transfer(bob, ether(transferCoinAmount), {from: alice, useGSN: true});
            assertRelayedCall(res);

            const aliceBalanaceAfter = await coinToken.balanceOf(alice);
            const bobBalanaceAfter = await coinToken.balanceOf(bob);
            const contractBalanceAfter = await coinToken.balanceOf(coinToken.address);

            const transferFee = (transferCoinAmount * feePercent / 100);
            const bothFees = opsFee.plus(new BigNumber(transferFee));

            assertErc20BalanceChanged(aliceBalanaceBefore, aliceBalanaceAfter, ether(-transferCoinAmount - opsFee));
            assertErc20BalanceChanged(bobBalanaceBefore, bobBalanaceAfter, ether(transferCoinAmount - (transferCoinAmount / 100 * feePercent)));
            assertErc20BalanceChanged(contractBalanceBefore, contractBalanceAfter, ether(bothFees));

            const deployerBalanceBefore = await coinToken.balanceOf(deployer);
            await coinToken.withdrawFee({from: deployer});
            const deployerBalanceAfter = await coinToken.balanceOf(deployer);

            assertErc20BalanceChanged(deployerBalanceBefore, deployerBalanceAfter, ether(bothFees));
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
