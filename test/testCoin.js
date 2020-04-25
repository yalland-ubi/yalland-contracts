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
const { buildCoinDistAndExchange } = require('./builders');

const CoinToken = contract.fromArtifact('CoinToken');
const zero = new BigNumber(0);

CoinToken.numberFormat = 'String';

const { ether, increaseTime, evmMineBlock, assertRevert, now, assertErc20BalanceChanged } = require('@galtproject/solidity-test-chest')(web3);
const { approveFunction, assertRelayedCall } = require('./helpers')(web3);

const keccak256 = web3.utils.soliditySha3;


describe('Coin', () => {
    const [pauser, alice, bob, charlie, dan, minter, verifier, feeManager, transferWlManager] = accounts;
    const deployer = defaultSender;

    let registry;
    let coinToken;
    let dist;
    const periodLength = 7 * 24 * 60 * 60;
    const periodVolume = ether(250 * 1000);
    const verifierRewardShare = ether(10);
    const baseAliceBalance = new BigNumber(100000000);
    const feePercent = 0.02;
    const gsnFee = new BigNumber(0.7);
    const startAfter = 10;
    const memberId1 = keccak256('bob');
    let genesisTimestamp;

    before(async function() {
        // dist = await YALDistributor.new();
        // dist.contract.currentProvider.wrappedProvider.relayClient.approveFunction = approveFunction;
    });

    beforeEach(async function () {
        [ registry, coinToken, dist ] = await buildCoinDistAndExchange(web3, defaultSender, verifier);

        await coinToken.addRoleTo(dist.address, 'minter');
        await coinToken.addRoleTo(minter, 'minter');
        await coinToken.addRoleTo(feeManager, 'fee_manager');
        await coinToken.addRoleTo(transferWlManager, 'transfer_wl_manager');

        await coinToken.mint(alice, ether(baseAliceBalance), {from: minter});
        await coinToken.setTransferFee(ether(feePercent), {from: feeManager});
        await coinToken.setGsnFee(ether(gsnFee), {from: feeManager});

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

    describe('#getTransferFee()', () => {
        it('should calculate fees correctly', async function() {
            await coinToken.setTransferFee(ether(0.02), { from: feeManager });
            assert.equal(await coinToken.getTransferFee(ether(1)), ether(0.0002));

            await coinToken.setTransferFee(ether(30), { from: feeManager });
            assert.equal(await coinToken.getTransferFee(ether(1)), ether(0.3));
        })

        it('should calculate negligible fees correctly', async function() {
            await coinToken.setTransferFee(ether(20), { from: feeManager });

            assert.equal(await coinToken.getTransferFee(10), 2);
            assert.equal(await coinToken.getTransferFee(8), 1);
            assert.equal(await coinToken.getTransferFee(5), 1);
            assert.equal(await coinToken.getTransferFee(4), 0);
            assert.equal(await coinToken.getTransferFee(1), 0);
        })

        it('should return 0 for 0 fee', async function() {
            await coinToken.setTransferFee(0, { from: feeManager });
            assert.equal(await coinToken.getTransferFee(ether(250)), 0);
            assert.equal(await coinToken.getTransferFee(0), 0);
        })
    });

    describe('Pausable', () => {
        it('should deny transferring when paused', async function() {
            await coinToken.addRoleTo(pauser, await coinToken.PAUSER_ROLE(), { from: deployer });
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
            await coinToken.setWhitelistAddress(dan, true, { from: transferWlManager });
            assert.equal(await coinToken.isMemberValid(dan), true);
        });
    });

    describe('#setWhitelistAddress()', () => {
        it('should deny non wl manager calling the method', async function() {
            await assertRevert(
                coinToken.setWhitelistAddress(dan, true, { from: defaultSender }),
                'Only transfer_wl_manager allowed.'
            );
        });

        it('should change wl value', async function() {
            assert.equal(await coinToken.opsWhitelist(dan), false);
            await coinToken.setWhitelistAddress(dan, true, { from: transferWlManager });
            assert.equal(await coinToken.opsWhitelist(dan), true);
            await coinToken.setWhitelistAddress(dan, false, { from: transferWlManager });
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

            assertErc20BalanceChanged(aliceBalanceBefore, aliceBalanaceAfter, ether(-gsnFee));
            assertErc20BalanceChanged(bobBalanceBefore, bobBalanceAfter, '0');
            assertErc20BalanceChanged(contractBalanceBefore, contractBalanceAfter, ether(gsnFee));
        });

        it('should charge on each approval which uses GSN', async function () {
            const transferCoinAmount = 1000;
            const totalSupply = await coinToken.totalSupply();

            const aliceBalanceBefore = await coinToken.balanceOf(alice);
            const bobBalanceBefore = await coinToken.balanceOf(bob);
            const contractBalanceBefore = await coinToken.balanceOf(coinToken.address);

            assert.equal(aliceBalanceBefore, ether(baseAliceBalance));
            assert.equal(bobBalanceBefore, ether(0));
            assert.equal(contractBalanceBefore, ether(0));

            // just to increment and get the current block
            let res = await coinToken.addRoleTo(alice, 'foo');
            const zeroBlock = res.receipt.blockNumber;

            await evmMineBlock();

            res = await coinToken.approve(charlie, ether(transferCoinAmount), { from: alice, useGSN: true });
            const firstBlock = res.receipt.blockNumber;
            await evmMineBlock();

            res = await coinToken.approve(charlie, ether(2 * transferCoinAmount), { from: alice, useGSN: true });
            const secondBlock = res.receipt.blockNumber;
            await evmMineBlock();

            res = await coinToken.approve(charlie, ether(0), { from: alice, useGSN: true });
            const thirdBlock = res.receipt.blockNumber;
            await evmMineBlock();

            const aliceBalanceAfter = await coinToken.balanceOf(alice);
            const bobBalanceAfter = await coinToken.balanceOf(bob);
            const contractBalanceAfter = await coinToken.balanceOf(coinToken.address);

            assertErc20BalanceChanged(aliceBalanceBefore, aliceBalanceAfter, ether(- (gsnFee.multipliedBy(3))));
            assertErc20BalanceChanged(bobBalanceBefore, bobBalanceAfter, '0');
            assertErc20BalanceChanged(contractBalanceBefore, contractBalanceAfter, ether(gsnFee.multipliedBy(3)));
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
                await coinToken.mint(charlie, ether(baseAliceBalance), {from: minter});
                await coinToken.approve(charlie, ether(1), { from: alice });
                await coinToken.transferFrom(alice, bob, ether(1), { from: charlie });
            });
        });

        it('should correct transfer with fee using GSN', async function () {
            const ten = new BigNumber(10);
            await coinToken.mint(charlie, ether(ten), {from: minter});
            const transferCoinAmount = new BigNumber('2.7');
            const totalSupply = await coinToken.totalSupply();

            const aliceBalanceBefore = await coinToken.balanceOf(alice);
            const bobBalanceBefore = await coinToken.balanceOf(bob);
            const charlieBalanceBefore = await coinToken.balanceOf(charlie);
            const contractBalanceBefore = await coinToken.balanceOf(coinToken.address);

            assert.equal(await coinToken.balanceOf(charlie), ether(ten));

            // just to increment and get the current block
            let res = await coinToken.addRoleTo(alice, 'foo');
            const zeroBlock = res.receipt.blockNumber;

            await evmMineBlock();

            // 1st transfer
            await coinToken.approve(charlie, ether(transferCoinAmount), { from: alice });
            res = await coinToken.transferFrom(
                alice,
                bob,
                ether(transferCoinAmount.dividedBy(2)),
                {from: charlie, useGSN: true}
                );
            assertRelayedCall(res);
            const firstBlock = res.receipt.blockNumber;
            await evmMineBlock();

            assert.equal(
                await coinToken.allowance(alice, charlie),
                ether(transferCoinAmount.dividedBy(2))
            );

            // 2nd transfer
            res = await coinToken.transferFrom(
                alice,
                bob,
                ether(transferCoinAmount.dividedBy(4)),
                {from: charlie, useGSN: true}
            );
            assertRelayedCall(res);
            const secondBlock = res.receipt.blockNumber;
            await evmMineBlock();

            // 3rd transfer
            res = await coinToken.transferFrom(
                alice,
                bob,
                ether(transferCoinAmount.dividedBy(4)),
                {from: charlie, useGSN: true}
            );
            assertRelayedCall(res);
            const thirdBlock = res.receipt.blockNumber;
            await evmMineBlock();

            assert.equal(await coinToken.allowance(alice, charlie), 0);

            const aliceBalanaceAfter = await coinToken.balanceOf(alice);
            const bobBalanceAfter = await coinToken.balanceOf(bob);
            const charlieBalanceAfter = await coinToken.balanceOf(charlie);
            const contractBalanceAfter = await coinToken.balanceOf(coinToken.address);

            const transferFee = transferCoinAmount.multipliedBy(feePercent).dividedBy(100);
            const totalFees = gsnFee.multipliedBy(3).plus(transferFee);

            assertErc20BalanceChanged(
                aliceBalanceBefore,
                aliceBalanaceAfter,
                ether(zero.minus(transferCoinAmount))
            );
            assertErc20BalanceChanged(bobBalanceBefore, bobBalanceAfter, ether(transferCoinAmount));
            assertErc20BalanceChanged(
                charlieBalanceBefore,
                charlieBalanceAfter,
                ether(zero.minus(totalFees))
            );
            assertErc20BalanceChanged(contractBalanceBefore, contractBalanceAfter, ether(totalFees));

            const feeManagerBalanceBefore = await coinToken.balanceOf(feeManager);
            await coinToken.withdrawFee({ from: feeManager });
            const feeManagerBalanceAfter = await coinToken.balanceOf(feeManager);

            assertErc20BalanceChanged(feeManagerBalanceBefore, feeManagerBalanceAfter, ether(totalFees));

            // final values
            assert.equal(
                await coinToken.balanceOf(alice),
                ether(baseAliceBalance.minus(transferCoinAmount))
            );
            assert.equal(await coinToken.balanceOf(bob), ether(transferCoinAmount));
            assert.equal(
                await coinToken.balanceOf(charlie),
                ether(ten
                    .minus(gsnFee.multipliedBy(3))
                    .minus(transferFee)
                )
            );
            assert.equal(await coinToken.balanceOf(coinToken.address), ether(0));
            assert.equal(await coinToken.balanceOf(feeManager), ether(totalFees));
            assert.equal(await coinToken.totalSupply(), totalSupply);

        });

        it('should correct transfer with fee', async function () {
            await coinToken.mint(bob, ether(baseAliceBalance), {from: minter});
            const transferCoinAmount = new BigNumber(1000);

            const aliceBalanceBefore = await coinToken.balanceOf(alice);
            const bobBalanceBefore = await coinToken.balanceOf(bob);
            const contractBalanceBefore = await coinToken.balanceOf(coinToken.address);

            await coinToken.approve(bob, ether(transferCoinAmount), { from: alice });
            await coinToken.transferFrom(alice, bob, ether(transferCoinAmount / 2), {from: bob});

            assert.equal(await coinToken.allowance(alice, bob), ether(transferCoinAmount / 2));

            await coinToken.transferFrom(alice, bob, ether(transferCoinAmount / 2), {from: bob});

            assert.equal(await coinToken.allowance(alice, bob), 0);

            const transferFee = transferCoinAmount.multipliedBy(feePercent).dividedBy(100);

            const aliceBalanaceAfter = await coinToken.balanceOf(alice);
            const bobBalanceAfter = await coinToken.balanceOf(bob);
            const contractBalanceAfter = await coinToken.balanceOf(coinToken.address);

            assertErc20BalanceChanged(
                aliceBalanceBefore,
                aliceBalanaceAfter,
                ether(-transferCoinAmount)
            );
            assertErc20BalanceChanged(
                bobBalanceBefore,
                bobBalanceAfter,
                ether(transferCoinAmount.minus(transferFee))
            );
            assertErc20BalanceChanged(
                contractBalanceBefore,
                contractBalanceAfter,
                ether(transferFee )
            );

            const feeManagerBalanceBefore = await coinToken.balanceOf(feeManager);
            await coinToken.withdrawFee({from: feeManager});
            const feeManagerBalanceAfter = await coinToken.balanceOf(feeManager);

            assertErc20BalanceChanged(feeManagerBalanceBefore, feeManagerBalanceAfter, ether(transferCoinAmount / 100 * feePercent));
        });

        it('should revert if there is no fee to cover transfer fee expenses', async function () {
            await coinToken.mint(bob, ether(10), {from: minter});
            assert.equal(await coinToken.balanceOf(bob), ether(10));

            await coinToken.approve(bob, ether('9.9999'), { from: bob });
            assertRevert(
                coinToken.transferFrom(bob, alice, ether('9.9999'), { from: bob }),
                'YALToken: insufficient balance for paying a fee'
            )
        });

        it('should allow if the balance is exact sum of the amount being transferring and a fee', async function () {
            // 10 eth + (10 eth * 0.02%)
            await coinToken.mint(bob, ether('10.002'), {from: minter});
            assert.equal(await coinToken.balanceOf(bob), ether('10.002'));

            await coinToken.approve(bob, ether('10'), { from: bob });
            await coinToken.transferFrom(bob, alice, ether('10'), { from: bob });

            assert.equal(await coinToken.balanceOf(bob), ether(0));
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
            const transferCoinAmount = new BigNumber('2.7');
            const totalSupply = await coinToken.totalSupply();

            const aliceBalanaceBefore = await coinToken.balanceOf(alice);
            const bobBalanaceBefore = await coinToken.balanceOf(bob);
            const contractBalanceBefore = await coinToken.balanceOf(coinToken.address);

            // just to increment and get the current block
            let res = await coinToken.addRoleTo(alice, 'foo');
            const zeroBlock = res.receipt.blockNumber;

            await evmMineBlock();

            // 1st transfer
            res = await coinToken.transfer(bob, ether(transferCoinAmount.dividedBy(2)), {from: alice, useGSN: true});
            assertRelayedCall(res);
            const firstBlock = res.receipt.blockNumber;
            await evmMineBlock();

            // 2nd transfer
            res = await coinToken.transfer(bob, ether(transferCoinAmount.dividedBy(4)), {from: alice, useGSN: true});
            assertRelayedCall(res);
            const secondBlock = res.receipt.blockNumber;
            await evmMineBlock();

            // 3rd transfer
            res = await coinToken.transfer(bob, ether(transferCoinAmount.dividedBy(4)), {from: alice, useGSN: true});
            assertRelayedCall(res);
            const thirdBlock = res.receipt.blockNumber;
            await evmMineBlock();

            const aliceBalanaceAfter = await coinToken.balanceOf(alice);
            const bobBalanaceAfter = await coinToken.balanceOf(bob);
            const contractBalanceAfter = await coinToken.balanceOf(coinToken.address);

            const transferFee = transferCoinAmount.multipliedBy(feePercent).dividedBy(100);
            const totalFees = gsnFee.multipliedBy(3).plus(transferFee);

            assertErc20BalanceChanged(aliceBalanaceBefore, aliceBalanaceAfter, ether(zero.minus(transferCoinAmount).minus(totalFees)));
            assertErc20BalanceChanged(bobBalanaceBefore, bobBalanaceAfter, ether(transferCoinAmount));
            assertErc20BalanceChanged(contractBalanceBefore, contractBalanceAfter, ether(totalFees));

            const feeManagerBalanceBefore = await coinToken.balanceOf(feeManager);
            res = await coinToken.withdrawFee({from: feeManager});
            const fourthBlock = res.receipt.blockNumber;
            await evmMineBlock();
            const feeManagerBalanceAfter = await coinToken.balanceOf(feeManager);

            assertErc20BalanceChanged(feeManagerBalanceBefore, feeManagerBalanceAfter, ether(totalFees));

            // final values
            assert.equal(
                await coinToken.balanceOf(alice),
                ether(baseAliceBalance.minus(transferCoinAmount).minus(totalFees))
            );
            assert.equal(await coinToken.balanceOf(bob), ether(transferCoinAmount));
            assert.equal(await coinToken.balanceOf(coinToken.address), ether(0));
            assert.equal(await coinToken.balanceOf(feeManager), ether(totalFees));
            assert.equal(await coinToken.totalSupply(), totalSupply);
        });

        it('should correct transfer with transfer fee only', async function () {
            const transferCoinAmount = 1000;

            const aliceBalanaceBefore = await coinToken.balanceOf(alice);
            const bobBalanaceBefore = await coinToken.balanceOf(bob);
            const contractBalanceBefore = await coinToken.balanceOf(coinToken.address);

            await coinToken.transfer(bob, ether(transferCoinAmount), {from: alice});

            const aliceBalanaceAfter = await coinToken.balanceOf(alice);
            const bobBalanaceAfter = await coinToken.balanceOf(bob);
            const contractBalanceAfter = await coinToken.balanceOf(coinToken.address);

            assertErc20BalanceChanged(aliceBalanaceBefore, aliceBalanaceAfter, ether(zero.minus(transferCoinAmount).minus(transferCoinAmount * feePercent / 100)));
            assertErc20BalanceChanged(bobBalanaceBefore, bobBalanaceAfter, ether(transferCoinAmount));
            assertErc20BalanceChanged(contractBalanceBefore, contractBalanceAfter, ether(transferCoinAmount * feePercent / 100));

            const feeManagerBalanceBefore = await coinToken.balanceOf(feeManager);
            await coinToken.withdrawFee({from: feeManager});
            const feeManagerBalanceAfter = await coinToken.balanceOf(feeManager);

            assertErc20BalanceChanged(feeManagerBalanceBefore, feeManagerBalanceAfter, ether(transferCoinAmount / 100 * feePercent));
        });

        it('should revert if there is no fee to cover transfer fee expenses', async function () {
            await coinToken.mint(bob, ether(10), {from: minter});
            assert.equal(await coinToken.balanceOf(bob), ether(10));

            assertRevert(
                coinToken.transfer(alice, ether('9.9999'), { from: bob }),
                'YALToken: insufficient balance for paying a fee'
            )
        });

        it('should allow if the balance is exact sum of the amount being transferring and a fee', async function () {
            // 10 eth + (10 eth * 0.02%)
            await coinToken.mint(bob, ether('10.002'), {from: minter});
            assert.equal(await coinToken.balanceOf(bob), ether('10.002'));

            await coinToken.transfer(alice, ether('10'), { from: bob });

            assert.equal(await coinToken.balanceOf(bob), ether(0));
        });
    });
});
