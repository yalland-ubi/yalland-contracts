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

const YALLToken = contract.fromArtifact('YALLToken');
const zero = new BigNumber(0);

YALLToken.numberFormat = 'String';

const { ether, increaseTime, evmMineBlock, assertRevert, now, assertErc20BalanceChanged } = require('@galtproject/solidity-test-chest')(web3);
const { approveFunction, assertRelayedCall } = require('./helpers')(web3);

const keccak256 = web3.utils.soliditySha3;


describe('YALLToken', () => {
    const [pauser, alice, bob, charlie, dan, yallMinter, distributorVerifier, feeManager, feeClaimer, yallWLManager] = accounts;
    const deployer = defaultSender;

    let registry;
    let yallToken;
    let dist;
    const periodLength = 7 * 24 * 60 * 60;
    const periodVolume = ether(250 * 1000);
    const distributorVerifierRewardShare = ether(10);
    const baseAliceBalance = new BigNumber(100000000);
    const feePercent = 0.02;
    const gsnFee = new BigNumber(0.7);
    const startAfter = 10;
    const memberId1 = keccak256('bob');
    let genesisTimestamp;

    beforeEach(async function () {
        [ registry, yallToken, dist ] = await buildCoinDistAndExchange(web3, defaultSender, {
            distributorVerifier,
            yallMinter,
            feeManager,
            feeClaimer,
            pauser,
            yallWLManager
        });

        await yallToken.mint(alice, ether(baseAliceBalance), {from: yallMinter});
        await yallToken.setTransferFee(ether(feePercent), {from: feeManager});
        await yallToken.setGsnFee(ether(gsnFee), {from: feeManager});

        await dist.addMembersBeforeGenesis(
            [keccak256('foo'), keccak256('bar'), keccak256('bazz')],
            [alice, bob, charlie],
            { from: distributorVerifier }
            );
        await increaseTime(20);

        yallToken.contract.currentProvider.wrappedProvider.relayClient.approveFunction = approveFunction;

        await deployRelayHub(web3);
        await fundRecipient(web3, { recipient: dist.address, amount: ether(1) });
        await fundRecipient(web3, { recipient: yallToken.address, amount: ether(1) });
    });

    describe('#getTransferFee()', () => {
        it('should calculate fees correctly', async function() {
            await yallToken.setTransferFee(ether(0.02), { from: feeManager });
            assert.equal(await yallToken.getTransferFee(ether(1)), ether(0.0002));

            await yallToken.setTransferFee(ether(30), { from: feeManager });
            assert.equal(await yallToken.getTransferFee(ether(1)), ether(0.3));
        })

        it('should calculate negligible fees correctly', async function() {
            await yallToken.setTransferFee(ether(20), { from: feeManager });

            assert.equal(await yallToken.getTransferFee(10), 2);
            assert.equal(await yallToken.getTransferFee(8), 1);
            assert.equal(await yallToken.getTransferFee(5), 1);
            assert.equal(await yallToken.getTransferFee(4), 0);
            assert.equal(await yallToken.getTransferFee(1), 0);
        })

        it('should return 0 for 0 fee', async function() {
            await yallToken.setTransferFee(0, { from: feeManager });
            assert.equal(await yallToken.getTransferFee(ether(250)), 0);
            assert.equal(await yallToken.getTransferFee(0), 0);
        })
    });

    describe('Pausable', () => {
        it('should deny transferring when paused', async function() {
            await registry.setRole(pauser, await yallToken.PAUSER_ROLE(), true);
            await assertRevert(yallToken.pause({ from: deployer }), 'YALLHelpers: Only PAUSER allowed');

            // approve before paused
            await yallToken.approve(bob, ether(10), { from: alice });

            await yallToken.pause({ from: pauser });

            await assertRevert(yallToken.transfer(bob, ether(1), { from: alice }), 'paused');
            await assertRevert(yallToken.transferWithMemo(bob, ether(1), 'hey', { from: alice }), 'paused');
            await assertRevert(yallToken.transferFrom(alice, charlie, ether(1), { from: bob }), 'paused');
            await assertRevert(yallToken.approve(alice, ether(1), { from: bob }), 'paused');

            await yallToken.unpause({ from: pauser });

            await yallToken.transfer(bob, ether(1), { from: alice });
            await yallToken.transferWithMemo(bob, ether(1), 'hey', { from: alice });
            await yallToken.transferFrom(alice, charlie, ether(1), { from: bob });
            await yallToken.approve(bob, ether(10), { from: alice });
        });
    });

    describe('#isMemberValid()', () => {
        it('should return false for inactive member', async function() {
            assert.equal(await yallToken.isMemberValid(dan), false);
        });

        it('should return true if the address is inside YALLDistributor active list', async function() {
            await dist.addMember(keccak256('dan'), dan, { from: distributorVerifier });
            assert.equal(await yallToken.isMemberValid(dan), true);
        });

        it('should return true if the address is inside coin token whitelist', async function() {
            await yallToken.setWhitelistAddress(dan, true, { from: yallWLManager });
            assert.equal(await yallToken.isMemberValid(dan), true);
        });
    });

    describe('#setWhitelistAddress()', () => {
        it('should deny non wl manager calling the method', async function() {
            await assertRevert(
                yallToken.setWhitelistAddress(dan, true, { from: defaultSender }),
                'YALLToken: Only YALL_TOKEN_WHITELIST_MANAGER allowed.'
            );
        });

        it('should change wl value', async function() {
            assert.equal(await yallToken.opsWhitelist(dan), false);
            await yallToken.setWhitelistAddress(dan, true, { from: yallWLManager });
            assert.equal(await yallToken.opsWhitelist(dan), true);
            await yallToken.setWhitelistAddress(dan, false, { from: yallWLManager });
            assert.equal(await yallToken.opsWhitelist(dan), false);
        });
    });

    describe('#approve()', () => {
        describe('approve restrictions', () => {
            it('should deny approving if the approver is inactive', async function() {
                await dist.disableMembers([alice], { from: distributorVerifier });
                await assertRevert(yallToken.approve(bob, ether(1), { from: alice }), 'Member is invalid');
            });

            it('should deny approving if the receiver is inactive', async function() {
                await dist.disableMembers([bob], { from: distributorVerifier });
                await assertRevert(yallToken.approve(bob, ether(1), { from: alice }), 'Member is invalid');
            });

            it('should allow approving when both approver and receiver are active', async function() {
                await yallToken.approve(charlie, ether(1), { from: alice });
            });
        });

        it('should correctly approve with fee using GSN', async function () {
            const transferCoinAmount = 1000;

            const aliceBalanceBefore = await yallToken.balanceOf(alice);
            const bobBalanceBefore = await yallToken.balanceOf(bob);
            const contractBalanceBefore = await yallToken.balanceOf(yallToken.address);

            let res = await yallToken.approve(charlie, ether(transferCoinAmount), { from: alice, useGSN: true });
            assertRelayedCall(res);

            const aliceBalanaceAfter = await yallToken.balanceOf(alice);
            const bobBalanceAfter = await yallToken.balanceOf(bob);
            const contractBalanceAfter = await yallToken.balanceOf(yallToken.address);

            assertErc20BalanceChanged(aliceBalanceBefore, aliceBalanaceAfter, ether(-gsnFee));
            assertErc20BalanceChanged(bobBalanceBefore, bobBalanceAfter, '0');
            assertErc20BalanceChanged(contractBalanceBefore, contractBalanceAfter, ether(gsnFee));
        });

        it('should charge on each approval which uses GSN', async function () {
            const transferCoinAmount = 1000;
            const totalSupply = await yallToken.totalSupply();

            const aliceBalanceBefore = await yallToken.balanceOf(alice);
            const bobBalanceBefore = await yallToken.balanceOf(bob);
            const contractBalanceBefore = await yallToken.balanceOf(yallToken.address);

            assert.equal(aliceBalanceBefore, ether(baseAliceBalance));
            assert.equal(bobBalanceBefore, ether(0));
            assert.equal(contractBalanceBefore, ether(0));

            await evmMineBlock();

            let res = await yallToken.approve(charlie, ether(transferCoinAmount), { from: alice, useGSN: true });
            await evmMineBlock();

            res = await yallToken.approve(charlie, ether(2 * transferCoinAmount), { from: alice, useGSN: true });
            await evmMineBlock();

            res = await yallToken.approve(charlie, ether(0), { from: alice, useGSN: true });
            await evmMineBlock();

            const aliceBalanceAfter = await yallToken.balanceOf(alice);
            const bobBalanceAfter = await yallToken.balanceOf(bob);
            const contractBalanceAfter = await yallToken.balanceOf(yallToken.address);

            assertErc20BalanceChanged(aliceBalanceBefore, aliceBalanceAfter, ether(- (gsnFee.multipliedBy(3))));
            assertErc20BalanceChanged(bobBalanceBefore, bobBalanceAfter, '0');
            assertErc20BalanceChanged(contractBalanceBefore, contractBalanceAfter, ether(gsnFee.multipliedBy(3)));
        });
    });

    describe('#transferFrom()', () => {
        describe('transfer restrictions', () => {
            it('should deny transferring if a from address is not active', async function() {
                await yallToken.approve(charlie, ether(1), { from: alice });
                await dist.disableMembers([alice], { from: distributorVerifier });
                await assertRevert(yallToken.transferFrom(alice, bob, ether(1), { from: charlie }), 'Member is invalid');
            });

            it('should deny transferring if a to address is not active', async function() {
                await yallToken.approve(charlie, ether(1), { from: alice });
                await dist.disableMembers([bob], { from: distributorVerifier });
                await assertRevert(yallToken.transferFrom(alice, bob, ether(1), { from: charlie }), 'Member is invalid');
            });

            it('should deny transferring if a tx sender is not active', async function() {
                await yallToken.approve(charlie, ether(1), { from: alice });
                await dist.disableMembers([charlie], { from: distributorVerifier });
                await assertRevert(yallToken.transferFrom(alice, bob, ether(1), { from: charlie }), 'Member is invalid');
            });

            it('should allow transferring all from, to and tx sender are active', async function() {
                await yallToken.mint(charlie, ether(baseAliceBalance), {from: yallMinter});
                await yallToken.approve(charlie, ether(1), { from: alice });
                await yallToken.transferFrom(alice, bob, ether(1), { from: charlie });
            });
        });

        it('should correct transfer with fee using GSN', async function () {
            const ten = new BigNumber(10);
            await yallToken.mint(charlie, ether(ten), {from: yallMinter});
            const transferCoinAmount = new BigNumber('2.7');
            const totalSupply = await yallToken.totalSupply();

            const aliceBalanceBefore = await yallToken.balanceOf(alice);
            const bobBalanceBefore = await yallToken.balanceOf(bob);
            const charlieBalanceBefore = await yallToken.balanceOf(charlie);
            const contractBalanceBefore = await yallToken.balanceOf(yallToken.address);

            assert.equal(await yallToken.balanceOf(charlie), ether(ten));

            await evmMineBlock();

            // 1st transfer
            await yallToken.approve(charlie, ether(transferCoinAmount), { from: alice });
            let res = await yallToken.transferFrom(
                alice,
                bob,
                ether(transferCoinAmount.dividedBy(2)),
                {from: charlie, useGSN: true}
                );
            assertRelayedCall(res);
            await evmMineBlock();

            assert.equal(
                await yallToken.allowance(alice, charlie),
                ether(transferCoinAmount.dividedBy(2))
            );

            // 2nd transfer
            res = await yallToken.transferFrom(
                alice,
                bob,
                ether(transferCoinAmount.dividedBy(4)),
                {from: charlie, useGSN: true}
            );
            assertRelayedCall(res);
            const secondBlock = res.receipt.blockNumber;
            await evmMineBlock();

            // 3rd transfer
            res = await yallToken.transferFrom(
                alice,
                bob,
                ether(transferCoinAmount.dividedBy(4)),
                {from: charlie, useGSN: true}
            );
            assertRelayedCall(res);
            const thirdBlock = res.receipt.blockNumber;
            await evmMineBlock();

            assert.equal(await yallToken.allowance(alice, charlie), 0);

            const aliceBalanaceAfter = await yallToken.balanceOf(alice);
            const bobBalanceAfter = await yallToken.balanceOf(bob);
            const charlieBalanceAfter = await yallToken.balanceOf(charlie);
            const contractBalanceAfter = await yallToken.balanceOf(yallToken.address);

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

            const feeClaimerBalanceBefore = await yallToken.balanceOf(feeClaimer);
            await yallToken.withdrawFee({ from: feeClaimer });
            const feeClaimerBalanceAfter = await yallToken.balanceOf(feeClaimer);

            assertErc20BalanceChanged(feeClaimerBalanceBefore, feeClaimerBalanceAfter, ether(totalFees));

            // final values
            assert.equal(
                await yallToken.balanceOf(alice),
                ether(baseAliceBalance.minus(transferCoinAmount))
            );
            assert.equal(await yallToken.balanceOf(bob), ether(transferCoinAmount));
            assert.equal(
                await yallToken.balanceOf(charlie),
                ether(ten
                    .minus(gsnFee.multipliedBy(3))
                    .minus(transferFee)
                )
            );
            assert.equal(await yallToken.balanceOf(yallToken.address), ether(0));
            assert.equal(await yallToken.balanceOf(feeClaimer), ether(totalFees));
            assert.equal(await yallToken.totalSupply(), totalSupply);

        });

        it('should correct transfer with fee', async function () {
            await yallToken.mint(bob, ether(baseAliceBalance), {from: yallMinter});
            const transferCoinAmount = new BigNumber(1000);

            const aliceBalanceBefore = await yallToken.balanceOf(alice);
            const bobBalanceBefore = await yallToken.balanceOf(bob);
            const contractBalanceBefore = await yallToken.balanceOf(yallToken.address);

            await yallToken.approve(bob, ether(transferCoinAmount), { from: alice });
            await yallToken.transferFrom(alice, bob, ether(transferCoinAmount / 2), {from: bob});

            assert.equal(await yallToken.allowance(alice, bob), ether(transferCoinAmount / 2));

            await yallToken.transferFrom(alice, bob, ether(transferCoinAmount / 2), {from: bob});

            assert.equal(await yallToken.allowance(alice, bob), 0);

            const transferFee = transferCoinAmount.multipliedBy(feePercent).dividedBy(100);

            const aliceBalanaceAfter = await yallToken.balanceOf(alice);
            const bobBalanceAfter = await yallToken.balanceOf(bob);
            const contractBalanceAfter = await yallToken.balanceOf(yallToken.address);

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

            const feeClaimerBalanceBefore = await yallToken.balanceOf(feeClaimer);
            await yallToken.withdrawFee({from: feeClaimer});
            const feeClaimerBalanceAfter = await yallToken.balanceOf(feeClaimer);

            assertErc20BalanceChanged(feeClaimerBalanceBefore, feeClaimerBalanceAfter, ether(transferCoinAmount / 100 * feePercent));
        });

        it('should revert if there is no fee to cover transfer fee expenses', async function () {
            await yallToken.mint(bob, ether(10), {from: yallMinter});
            assert.equal(await yallToken.balanceOf(bob), ether(10));

            await yallToken.approve(bob, ether('9.9999'), { from: bob });
            assertRevert(
                yallToken.transferFrom(bob, alice, ether('9.9999'), { from: bob }),
                'YALLToken: insufficient balance for paying a fee'
            )
        });

        it('should allow if the balance is exact sum of the amount being transferring and a fee', async function () {
            // 10 eth + (10 eth * 0.02%)
            await yallToken.mint(bob, ether('10.002'), {from: yallMinter});
            assert.equal(await yallToken.balanceOf(bob), ether('10.002'));

            await yallToken.approve(bob, ether('10'), { from: bob });
            await yallToken.transferFrom(bob, alice, ether('10'), { from: bob });

            assert.equal(await yallToken.balanceOf(bob), ether(0));
        });
    });

    describe('#transfer()', () => {
        describe('transfer restrictions', () => {
            it('should deny transfer if the sender is inactive', async function() {
                await dist.disableMembers([alice], { from: distributorVerifier });
                await assertRevert(yallToken.transfer(bob, ether(1), { from: alice }), 'Member is invalid');
            });
            it('should deny transfer if the receiver is inactive', async function() {
                await dist.disableMembers([bob], { from: distributorVerifier });
                await assertRevert(yallToken.transfer(bob, ether(1), { from: alice }), 'Member is invalid');
            });

            it('should allow transfer when both sender and receiver are active', async function() {
                await yallToken.transfer(charlie, ether(1), { from: alice });
            });
        });

        it('should correct transfer with fee using GSN', async function () {
            const transferCoinAmount = new BigNumber('2.7');
            const totalSupply = await yallToken.totalSupply();

            const aliceBalanaceBefore = await yallToken.balanceOf(alice);
            const bobBalanaceBefore = await yallToken.balanceOf(bob);
            const contractBalanceBefore = await yallToken.balanceOf(yallToken.address);

            await evmMineBlock();

            // 1st transfer
            let res = await yallToken.transfer(bob, ether(transferCoinAmount.dividedBy(2)), {from: alice, useGSN: true});
            assertRelayedCall(res);
            await evmMineBlock();

            // 2nd transfer
            res = await yallToken.transfer(bob, ether(transferCoinAmount.dividedBy(4)), {from: alice, useGSN: true});
            assertRelayedCall(res);
            await evmMineBlock();

            // 3rd transfer
            res = await yallToken.transfer(bob, ether(transferCoinAmount.dividedBy(4)), {from: alice, useGSN: true});
            assertRelayedCall(res);
            await evmMineBlock();

            const aliceBalanaceAfter = await yallToken.balanceOf(alice);
            const bobBalanaceAfter = await yallToken.balanceOf(bob);
            const contractBalanceAfter = await yallToken.balanceOf(yallToken.address);

            const transferFee = transferCoinAmount.multipliedBy(feePercent).dividedBy(100);
            const totalFees = gsnFee.multipliedBy(3).plus(transferFee);

            assertErc20BalanceChanged(aliceBalanaceBefore, aliceBalanaceAfter, ether(zero.minus(transferCoinAmount).minus(totalFees)));
            assertErc20BalanceChanged(bobBalanaceBefore, bobBalanaceAfter, ether(transferCoinAmount));
            assertErc20BalanceChanged(contractBalanceBefore, contractBalanceAfter, ether(totalFees));

            const feeClaimerBalanceBefore = await yallToken.balanceOf(feeClaimer);
            res = await yallToken.withdrawFee({from: feeClaimer});
            const fourthBlock = res.receipt.blockNumber;
            await evmMineBlock();
            const feeClaimerBalanceAfter = await yallToken.balanceOf(feeClaimer);

            assertErc20BalanceChanged(feeClaimerBalanceBefore, feeClaimerBalanceAfter, ether(totalFees));

            // final values
            assert.equal(
                await yallToken.balanceOf(alice),
                ether(baseAliceBalance.minus(transferCoinAmount).minus(totalFees))
            );
            assert.equal(await yallToken.balanceOf(bob), ether(transferCoinAmount));
            assert.equal(await yallToken.balanceOf(yallToken.address), ether(0));
            assert.equal(await yallToken.balanceOf(feeClaimer), ether(totalFees));
            assert.equal(await yallToken.totalSupply(), totalSupply);
        });

        it('should correct transfer with transfer fee only', async function () {
            const transferCoinAmount = 1000;

            const aliceBalanaceBefore = await yallToken.balanceOf(alice);
            const bobBalanaceBefore = await yallToken.balanceOf(bob);
            const contractBalanceBefore = await yallToken.balanceOf(yallToken.address);

            await yallToken.transfer(bob, ether(transferCoinAmount), {from: alice});

            const aliceBalanaceAfter = await yallToken.balanceOf(alice);
            const bobBalanaceAfter = await yallToken.balanceOf(bob);
            const contractBalanceAfter = await yallToken.balanceOf(yallToken.address);

            assertErc20BalanceChanged(aliceBalanaceBefore, aliceBalanaceAfter, ether(zero.minus(transferCoinAmount).minus(transferCoinAmount * feePercent / 100)));
            assertErc20BalanceChanged(bobBalanaceBefore, bobBalanaceAfter, ether(transferCoinAmount));
            assertErc20BalanceChanged(contractBalanceBefore, contractBalanceAfter, ether(transferCoinAmount * feePercent / 100));

            const feeClaimerBalanceBefore = await yallToken.balanceOf(feeClaimer);
            await yallToken.withdrawFee({from: feeClaimer});
            const feeClaimerBalanceAfter = await yallToken.balanceOf(feeClaimer);

            assertErc20BalanceChanged(feeClaimerBalanceBefore, feeClaimerBalanceAfter, ether(transferCoinAmount / 100 * feePercent));
        });

        it('should revert if there is no fee to cover transfer fee expenses', async function () {
            await yallToken.mint(bob, ether(10), {from: yallMinter});
            assert.equal(await yallToken.balanceOf(bob), ether(10));

            assertRevert(
                yallToken.transfer(alice, ether('9.9999'), { from: bob }),
                'YALLToken: insufficient balance for paying a fee'
            )
        });

        it('should allow if the balance is exact sum of the amount being transferring and a fee', async function () {
            // 10 eth + (10 eth * 0.02%)
            await yallToken.mint(bob, ether('10.002'), {from: yallMinter});
            assert.equal(await yallToken.balanceOf(bob), ether('10.002'));

            await yallToken.transfer(alice, ether('10'), { from: bob });

            assert.equal(await yallToken.balanceOf(bob), ether(0));
        });
    });
});
