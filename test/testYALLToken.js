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
const { buildCoinDistAndExchange, TransferRestrictionsMode } = require('./builders');

const YALLToken = contract.fromArtifact('YALLToken');
const zero = new BigNumber(0);

YALLToken.numberFormat = 'String';

const { ether, increaseTime, evmMineBlock, assertRevert, now, assertErc20BalanceChanged } = require('@galtproject/solidity-test-chest')(web3);
const { approveFunction, assertRelayedCall, assertYallWithdrawalChanged } = require('./helpers')(web3);

const keccak256 = web3.utils.soliditySha3;

describe('YALLToken', () => {
    const [pauser, alice, bob, charlie, dan, eve, frank, george, helen, jane, noYalls, yallMinter, distributorVerifier, feeManager, feeCollector, yallTokenManager] = accounts;
    const deployer = defaultSender;

    let registry;
    let yallToken;
    let dist;
    const periodLength = 7 * 24 * 60 * 60;
    const periodVolume = ether(250 * 1000);
    const distributorVerifierRewardShare = ether(10);
    const baseAliceBalance = new BigNumber(ether(100000000));
    const feePercent = 0.02;
    const gsnFee = new BigNumber(ether(0.7));
    const startAfter = 10;
    const memberId1 = keccak256('bob');
    let genesisTimestamp;

    beforeEach(async function () {
        ({ registry, yallToken, dist } = await buildCoinDistAndExchange(web3, defaultSender, {
            distributorVerifier,
            yallMinter,
            feeManager,
            pauser,
            yallTokenManager,
            feeCollector,
            disableExchange: true,
            disableEmission: true,
            disableCommission: true
        }));

        await yallToken.mint(alice, baseAliceBalance.toString(), {from: yallMinter});
        await yallToken.setTransferFee(ether(feePercent), {from: feeManager});
        await yallToken.setGsnFee(gsnFee, {from: feeManager});

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

            await yallToken.transfer(bob, ether(1), { from: alice });
            await yallToken.transferWithMemo(bob, ether(1), 'hey', { from: alice });
            await yallToken.transferFrom(alice, charlie, ether(1), { from: bob });
            await yallToken.approve(bob, ether(10), { from: alice });
            await yallToken.increaseAllowance(bob, ether(2), { from: alice });
            await yallToken.decreaseAllowance(bob, ether(2), { from: alice });

            await yallToken.pause({ from: pauser });

            await assertRevert(yallToken.transfer(bob, ether(1), { from: alice }), 'paused');
            await assertRevert(yallToken.transferWithMemo(bob, ether(1), 'hey', { from: alice }), 'paused');
            await assertRevert(yallToken.transferFrom(alice, charlie, ether(1), { from: bob }), 'paused');
            await assertRevert(yallToken.approve(alice, ether(1), { from: bob }), 'paused');
            await assertRevert(yallToken.increaseAllowance(alice, ether(1), { from: bob }), 'paused');
            await assertRevert(yallToken.decreaseAllowance(alice, ether(1), { from: bob }), 'paused');

            await yallToken.unpause({ from: pauser });

            await yallToken.transfer(bob, ether(1), { from: alice });
            await yallToken.transferWithMemo(bob, ether(1), 'hey', { from: alice });
            await yallToken.transferFrom(alice, charlie, ether(1), { from: bob });
            await yallToken.approve(bob, ether(10), { from: alice });
            await yallToken.increaseAllowance(bob, ether(2), { from: alice });
            await yallToken.decreaseAllowance(bob, ether(2), { from: alice });
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
            await yallToken.setCanTransferWhitelistAddress(dan, true, { from: yallTokenManager });
            assert.equal(await yallToken.isMemberValid(dan), true);
        });
    });

    describe('#approve()', () => {
        describe('approve restrictions', () => {
            it('should deny approving if the approver is inactive', async function() {
                await dist.disableMembers([alice], { from: distributorVerifier });
                await assertRevert(
                  yallToken.approve(bob, ether(1), { from: alice }),
                  'YALLToken: The address has no YALL token transfer permission'
                );
            });

            it('should deny approving if the receiver is inactive', async function() {
                await dist.disableMembers([bob], { from: distributorVerifier });
                await assertRevert(
                  yallToken.approve(bob, ether(1), { from: alice }),
                  'YALLToken: The address has no YALL token transfer permission'
                );
            });

            it('should allow approving when both approver and receiver are active', async function() {
                await yallToken.approve(charlie, ether(1), { from: alice });
            });
        });

        it('should correctly approve with fee using GSN', async function () {
            const transferCoinAmount = new BigNumber(ether(1000));

            const aliceBalanceBefore = await yallToken.balanceOf(alice);
            const bobBalanceBefore = await yallToken.balanceOf(bob);
            const feeCollectorBalanceBefore = await yallToken.balanceOf(feeCollector);

            let res = await yallToken.approve(charlie, transferCoinAmount, { from: alice, useGSN: true });
            assertRelayedCall(res);

            const aliceBalanaceAfter = await yallToken.balanceOf(alice);
            const bobBalanceAfter = await yallToken.balanceOf(bob);
            const feeCollectorBalanceAfter = await yallToken.balanceOf(feeCollector);

            assertErc20BalanceChanged(aliceBalanceBefore, aliceBalanaceAfter, gsnFee.multipliedBy(-1).toString());
            assertErc20BalanceChanged(bobBalanceBefore, bobBalanceAfter, '0');
            assertErc20BalanceChanged(feeCollectorBalanceBefore, feeCollectorBalanceAfter, gsnFee.toString());
        });

        it('should charge on each approval which uses GSN', async function () {
            const transferCoinAmount = new BigNumber(ether(1000));

            const aliceBalanceBefore = await yallToken.balanceOf(alice);
            const bobBalanceBefore = await yallToken.balanceOf(bob);
            const feeCollectorBalanceBefore = await yallToken.balanceOf(feeCollector);

            assert.equal(aliceBalanceBefore, baseAliceBalance.toString());
            assert.equal(bobBalanceBefore, ether(0));
            assert.equal(feeCollectorBalanceBefore, ether(0));

            await evmMineBlock();

            await yallToken.approve(charlie, ether(transferCoinAmount), { from: alice, useGSN: true });
            await evmMineBlock();

            await yallToken.approve(charlie, transferCoinAmount.multipliedBy(2), { from: alice, useGSN: true });
            await evmMineBlock();

            await yallToken.approve(charlie, 0, { from: alice, useGSN: true });
            await evmMineBlock();

            const aliceBalanceAfter = await yallToken.balanceOf(alice);
            const bobBalanceAfter = await yallToken.balanceOf(bob);
            const feeCollectorBalanceAfter = await yallToken.balanceOf(feeCollector);

            assertErc20BalanceChanged(aliceBalanceBefore, aliceBalanceAfter, (gsnFee.multipliedBy(3).multipliedBy(-1)).toString());
            assertErc20BalanceChanged(bobBalanceBefore, bobBalanceAfter, '0');
            assertErc20BalanceChanged(feeCollectorBalanceBefore, feeCollectorBalanceAfter, gsnFee.multipliedBy(3).toString());
        });
    });

    describe('#transferFrom()', () => {
        describe('transfer restrictions', () => {
            it('should deny transferring if a from address is not active', async function() {
                await yallToken.approve(charlie, ether(1), { from: alice });
                await dist.disableMembers([alice], { from: distributorVerifier });
                await assertRevert(yallToken.transferFrom(alice, bob, ether(1), { from: charlie }), 'YALLToken: The address has no YALL token transfer permission');
            });

            it('should deny transferring if a to address is not active', async function() {
                await yallToken.approve(charlie, ether(1), { from: alice });
                await dist.disableMembers([bob], { from: distributorVerifier });
                await assertRevert(yallToken.transferFrom(alice, bob, ether(1), { from: charlie }), 'YALLToken: The address has no YALL token transfer permission');
            });

            it('should deny transferring if a tx sender is not active', async function() {
                await yallToken.approve(charlie, ether(1), { from: alice });
                await dist.disableMembers([charlie], { from: distributorVerifier });
                await assertRevert(yallToken.transferFrom(alice, bob, ether(1), { from: charlie }), 'YALLToken: The address has no YALL token transfer permission');
            });

            it('should allow transferring all from, to and tx sender are active', async function() {
                await yallToken.mint(charlie, baseAliceBalance, {from: yallMinter});
                await yallToken.approve(charlie, ether(1), { from: alice });
                await yallToken.transferFrom(alice, bob, ether(1), { from: charlie });
            });
        });

        it('should correct transfer with fee using GSN', async function () {
            const ten = new BigNumber(ether(10));
            await yallToken.mint(charlie, ten, {from: yallMinter});
            const transferCoinAmount = new BigNumber(ether('2.7'));
            const totalSupply = await yallToken.totalSupply();

            const aliceBalanceBefore = await yallToken.balanceOf(alice);
            const bobBalanceBefore = await yallToken.balanceOf(bob);
            const charlieBalanceBefore = await yallToken.balanceOf(charlie);
            const feeCollectorBalanceBefore = await yallToken.balanceOf(feeCollector);

            assert.equal(await yallToken.balanceOf(charlie), ten);

            await evmMineBlock();

            // 1st transfer
            await yallToken.approve(charlie, transferCoinAmount.toString(), { from: alice });
            let res = await yallToken.transferFrom(
                alice,
                bob,
                transferCoinAmount.dividedBy(2).toString(),
                {from: charlie, useGSN: true}
                );
            assertRelayedCall(res);
            await evmMineBlock();

            assert.equal(
                await yallToken.allowance(alice, charlie),
                transferCoinAmount.dividedBy(2).toString()
            );

            // 2nd transfer
            res = await yallToken.transferFrom(
                alice,
                bob,
                transferCoinAmount.dividedBy(4).toString(),
                {from: charlie, useGSN: true}
            );
            assertRelayedCall(res);
            await evmMineBlock();

            // 3rd transfer
            res = await yallToken.transferFrom(
                alice,
                bob,
                transferCoinAmount.dividedBy(4).toString(),
                {from: charlie, useGSN: true}
            );
            assertRelayedCall(res);
            await evmMineBlock();

            assert.equal(await yallToken.allowance(alice, charlie), 0);

            const aliceBalanaceAfter = await yallToken.balanceOf(alice);
            const bobBalanceAfter = await yallToken.balanceOf(bob);
            const charlieBalanceAfter = await yallToken.balanceOf(charlie);
            const feeCollectorBalanceAfter = await yallToken.balanceOf(feeCollector);

            const transferFee = transferCoinAmount.multipliedBy(feePercent).dividedBy(100);
            const totalFees = gsnFee.multipliedBy(3).plus(transferFee);

            assertErc20BalanceChanged(
                aliceBalanceBefore,
                aliceBalanaceAfter,
                zero.minus(transferCoinAmount).toString()
            );
            assertErc20BalanceChanged(bobBalanceBefore, bobBalanceAfter, transferCoinAmount.toString());
            assertErc20BalanceChanged(
                charlieBalanceBefore,
                charlieBalanceAfter,
                zero.minus(totalFees).toString()
            );
            assertErc20BalanceChanged(feeCollectorBalanceBefore, feeCollectorBalanceAfter, totalFees.toString());

            // final values
            assert.equal(
                await yallToken.balanceOf(alice),
                baseAliceBalance.minus(transferCoinAmount).toString()
            );
            assert.equal(await yallToken.balanceOf(bob), transferCoinAmount.toString());
            assert.equal(
                await yallToken.balanceOf(charlie),
                ten.minus(gsnFee.multipliedBy(3)).minus(transferFee).toString()
            );
            assert.equal(await yallToken.totalSupply(), totalSupply);

        });

        it('should correct transfer with fee', async function () {
            await yallToken.mint(bob, ether(baseAliceBalance), {from: yallMinter});
            const transferCoinAmount = new BigNumber(ether(1000 * 1000));

            const aliceBalanceBefore = await yallToken.balanceOf(alice);
            const bobBalanceBefore = await yallToken.balanceOf(bob);
            const feeCollectorBalanceBefore = await yallToken.balanceOf(feeCollector);

            await yallToken.approve(bob, transferCoinAmount.toString(), { from: alice });
            await yallToken.transferFrom(alice, bob, transferCoinAmount.dividedBy(2), {from: bob});

            assert.equal(await yallToken.allowance(alice, bob), transferCoinAmount.dividedBy(2));

            await yallToken.transferFrom(alice, bob, transferCoinAmount.dividedBy(2), {from: bob});

            assert.equal(await yallToken.allowance(alice, bob), 0);

            const transferFee = transferCoinAmount.multipliedBy(feePercent).dividedBy(100);

            const aliceBalanaceAfter = await yallToken.balanceOf(alice);
            const bobBalanceAfter = await yallToken.balanceOf(bob);
            const feeCollectorBalanceAfter = await yallToken.balanceOf(feeCollector);

            assertErc20BalanceChanged(
                aliceBalanceBefore,
                aliceBalanaceAfter,
                transferCoinAmount.multipliedBy(-1).toString()
            );
            // bob has paid transferFee
            assertErc20BalanceChanged(
                bobBalanceBefore,
                bobBalanceAfter,
                transferCoinAmount.minus(transferFee).toString()
            );
            // yall token contract has received transferFee
            assertErc20BalanceChanged(
                feeCollectorBalanceBefore,
                feeCollectorBalanceAfter,
                transferFee.toString()
            );
        });

        it('should not charge a transfer fee for a noTranferFeeWhitelist member', async function () {
            await yallToken.setNoTransferFeeWhitelistAddress(bob, true, { from: yallTokenManager });
            await yallToken.mint(bob, ether(baseAliceBalance), {from: yallMinter});
            const transferCoinAmount = new BigNumber(ether(1000 * 1000));

            const aliceBalanceBefore = await yallToken.balanceOf(alice);
            const bobBalanceBefore = await yallToken.balanceOf(bob);
            const feeCollectorBalanceBefore = await yallToken.balanceOf(feeCollector);

            await yallToken.approve(bob, transferCoinAmount.toString(), { from: alice });
            await yallToken.transferFrom(alice, bob, transferCoinAmount.dividedBy(2), {from: bob});
            await yallToken.transferFrom(alice, bob, transferCoinAmount.dividedBy(2), {from: bob});

            const aliceBalanaceAfter = await yallToken.balanceOf(alice);
            const bobBalanceAfter = await yallToken.balanceOf(bob);
            const feeCollectorBalanceAfter = await yallToken.balanceOf(feeCollector);

            assertErc20BalanceChanged(
              aliceBalanceBefore,
              aliceBalanaceAfter,
              transferCoinAmount.multipliedBy(-1).toString()
            );
            // bob has paid transferFee
            assertErc20BalanceChanged(
              bobBalanceBefore,
              bobBalanceAfter,
              transferCoinAmount.toString()
            );
            // yall token contract has received transferFee
            assertErc20BalanceChanged(
              feeCollectorBalanceBefore,
              feeCollectorBalanceAfter,
              '0'
            );
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
                await assertRevert(
                  yallToken.transfer(bob, ether(1), { from: alice }),
                  'YALLToken: The address has no YALL token transfer permission'
                );
            });
            it('should deny transfer if the receiver is inactive', async function() {
                await dist.disableMembers([bob], { from: distributorVerifier });
                await assertRevert(
                  yallToken.transfer(bob, ether(1), { from: alice }),
                  'YALLToken: The address has no YALL token transfer permission'
                );
            });

            it('should allow transfer when both sender and receiver are active', async function() {
                await yallToken.transfer(charlie, ether(1), { from: alice });
            });
        });

        it('should correct transfer with fee using GSN', async function () {
            const transferCoinAmount = new BigNumber(ether('2.7'));
            const totalSupply = await yallToken.totalSupply();

            const aliceBalanaceBefore = await yallToken.balanceOf(alice);
            const bobBalanaceBefore = await yallToken.balanceOf(bob);
            const feeCollectorBalanceBefore = await yallToken.balanceOf(feeCollector);

            await evmMineBlock();

            // 1st transfer
            let res = await yallToken.transfer(bob, transferCoinAmount.dividedBy(2), {from: alice, useGSN: true});
            assertRelayedCall(res);
            await evmMineBlock();

            // 2nd transfer
            res = await yallToken.transfer(bob, transferCoinAmount.dividedBy(4), {from: alice, useGSN: true});
            assertRelayedCall(res);
            await evmMineBlock();

            // 3rd transfer
            res = await yallToken.transfer(bob, transferCoinAmount.dividedBy(4), {from: alice, useGSN: true});
            assertRelayedCall(res);
            await evmMineBlock();

            const aliceBalanaceAfter = await yallToken.balanceOf(alice);
            const bobBalanaceAfter = await yallToken.balanceOf(bob);
            const feeCollectorBalanceAfter = await yallToken.balanceOf(feeCollector);

            const transferFee = transferCoinAmount.multipliedBy(feePercent).dividedBy(100);
            const totalFees = gsnFee.multipliedBy(3).plus(transferFee);

            assertErc20BalanceChanged(aliceBalanaceBefore, aliceBalanaceAfter, zero.minus(transferCoinAmount).minus(totalFees).toString());
            assertErc20BalanceChanged(bobBalanaceBefore, bobBalanaceAfter, transferCoinAmount.toString());
            assertErc20BalanceChanged(feeCollectorBalanceBefore, feeCollectorBalanceAfter, totalFees.toString());

            // final values
            assert.equal(
                await yallToken.balanceOf(alice),
                baseAliceBalance.minus(transferCoinAmount).minus(totalFees)
            );
            assert.equal(await yallToken.balanceOf(bob), transferCoinAmount);
            assert.equal(await yallToken.totalSupply(), totalSupply);
        });

        it('should correct transfer with transfer fee only', async function () {
            const transferCoinAmount = new BigNumber(ether(1000 * 1000));
            const totalFees = transferCoinAmount.multipliedBy(feePercent).dividedBy(100);

            const aliceBalanaceBefore = await yallToken.balanceOf(alice);
            const bobBalanaceBefore = await yallToken.balanceOf(bob);
            const feeCollectorBalanceBefore = await yallToken.balanceOf(feeCollector);

            await yallToken.transfer(bob, transferCoinAmount, {from: alice});

            const aliceBalanaceAfter = await yallToken.balanceOf(alice);
            const bobBalanaceAfter = await yallToken.balanceOf(bob);
            const feeCollectorBalanceAfter = await yallToken.balanceOf(feeCollector);

            assertErc20BalanceChanged(aliceBalanaceBefore, aliceBalanaceAfter, zero.minus(transferCoinAmount).minus(transferCoinAmount * feePercent / 100).toString());
            assertErc20BalanceChanged(bobBalanaceBefore, bobBalanaceAfter, transferCoinAmount.toString());
            assertErc20BalanceChanged(feeCollectorBalanceBefore, feeCollectorBalanceAfter, totalFees.toString());
        });

        it('should not charge noTransferFee whitelist member', async function () {
            await yallToken.setNoTransferFeeWhitelistAddress(alice, true, { from: yallTokenManager });
            const transferCoinAmount = new BigNumber(ether(1000 * 1000));
            const totalFees = transferCoinAmount.multipliedBy(feePercent).dividedBy(100);

            const aliceBalanaceBefore = await yallToken.balanceOf(alice);
            const bobBalanaceBefore = await yallToken.balanceOf(bob);
            const feeCollectorBalanceBefore = await yallToken.balanceOf(feeCollector);

            await yallToken.transfer(bob, transferCoinAmount, {from: alice});

            const aliceBalanaceAfter = await yallToken.balanceOf(alice);
            const bobBalanaceAfter = await yallToken.balanceOf(bob);
            const feeCollectorBalanceAfter = await yallToken.balanceOf(feeCollector);

            assertErc20BalanceChanged(aliceBalanaceBefore, aliceBalanaceAfter, zero.minus(transferCoinAmount).toString());
            assertErc20BalanceChanged(bobBalanaceBefore, bobBalanaceAfter, transferCoinAmount.toString());
            assertErc20BalanceChanged(feeCollectorBalanceBefore, feeCollectorBalanceAfter, '0');
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

    describe('YALL_TOKEN_MANAGER interface', () => {
        describe('#setCanTransferWhitelistAddress()', () => {
            it('should deny non wl manager calling the method', async function() {
                await assertRevert(
                  yallToken.setCanTransferWhitelistAddress(dan, true, { from: defaultSender }),
                  'YALLToken: Only YALL_TOKEN_MANAGER allowed.'
                );
            });

            it('should change wl value', async function() {
                assert.equal(await yallToken.canTransferWhitelist(dan), false);
                await yallToken.setCanTransferWhitelistAddress(dan, true, { from: yallTokenManager });
                assert.equal(await yallToken.canTransferWhitelist(dan), true);
                await yallToken.setCanTransferWhitelistAddress(dan, false, { from: yallTokenManager });
                assert.equal(await yallToken.canTransferWhitelist(dan), false);
            });
        });

        describe('#setNoTransferFeeWhitelistAddress()', () => {
            it('should deny non yall manager calling the method', async function() {
                await assertRevert(
                  yallToken.setNoTransferFeeWhitelistAddress(dan, true, { from: defaultSender }),
                  'YALLToken: Only YALL_TOKEN_MANAGER allowed.'
                );
            });

            it('should change wl value', async function() {
                assert.equal(await yallToken.noTransferFeeWhitelist(dan), false);
                await yallToken.setNoTransferFeeWhitelistAddress(dan, true, { from: yallTokenManager });
                assert.equal(await yallToken.noTransferFeeWhitelist(dan), true);
                await yallToken.setNoTransferFeeWhitelistAddress(dan, false, { from: yallTokenManager });
                assert.equal(await yallToken.noTransferFeeWhitelist(dan), false);
            });
        });

        describe('#setTransferRestrictionMode()', () => {
            it('should deny non yall manager calling the method', async function() {
                await assertRevert(
                  yallToken.setTransferRestrictionMode(TransferRestrictionsMode.OFF, { from: defaultSender }),
                  'YALLToken: Only YALL_TOKEN_MANAGER allowed.'
                );
            });

            it('should change mode value', async function() {
                await yallToken.setTransferRestrictionMode(TransferRestrictionsMode.ONLY_MEMBERS_AND_WHITELIST, { from: yallTokenManager });
                assert.equal(await yallToken.transferRestrictions(), TransferRestrictionsMode.ONLY_MEMBERS_AND_WHITELIST);
                await yallToken.setTransferRestrictionMode(TransferRestrictionsMode.ONLY_MEMBERS, { from: yallTokenManager });
                assert.equal(await yallToken.transferRestrictions(), TransferRestrictionsMode.ONLY_MEMBERS);
            });

            describe('transfer()/transferFrom() behaviour', () => {
                beforeEach(async function() {
                    await yallToken.mint(alice, ether(10), { from: yallMinter });
                    await yallToken.mint(dan, ether(10), { from: yallMinter });

                    await yallToken.setCanTransferWhitelistAddress(dan, true, { from: yallTokenManager });
                    await yallToken.setCanTransferWhitelistAddress(eve, true, { from: yallTokenManager });
                    await yallToken.setCanTransferWhitelistAddress(frank, true, { from: yallTokenManager });

                    assert.equal(await dist.isActive(alice), true);
                    assert.equal(await dist.isActive(bob), true);
                    assert.equal(await dist.isActive(charlie), true);

                    assert.equal(await dist.isActive(dan), false);
                    assert.equal(await dist.isActive(eve), false);
                    assert.equal(await dist.isActive(frank), false);

                    assert.equal(await dist.isActive(george), false);
                    assert.equal(await dist.isActive(helen), false);
                    assert.equal(await dist.isActive(jane), false);

                    assert.equal(await yallToken.canTransferWhitelist(alice), false);
                    assert.equal(await yallToken.canTransferWhitelist(bob), false);
                    assert.equal(await yallToken.canTransferWhitelist(charlie), false);

                    assert.equal(await yallToken.canTransferWhitelist(dan), true);
                    assert.equal(await yallToken.canTransferWhitelist(eve), true);
                    assert.equal(await yallToken.canTransferWhitelist(frank), true);

                    assert.equal(await yallToken.canTransferWhitelist(george), false);
                    assert.equal(await yallToken.canTransferWhitelist(helen), false);
                    assert.equal(await yallToken.canTransferWhitelist(jane), false);
                })

                it('allow any address txs when the mode is OFF', async function() {
                    await yallToken.setTransferRestrictionMode(TransferRestrictionsMode.OFF, { from: yallTokenManager });

                    await yallToken.transfer(helen, ether(1), { from: dan });
                    await yallToken.approve(helen, ether(1), { from: dan });
                    await yallToken.transferFrom(dan, alice, ether(1), { from: helen });
                });

                describe('ONLY_MEMBERS mode', () => {
                    beforeEach(async function() {
                        await yallToken.mint(dan, ether(10), { from: yallMinter });
                        await yallToken.setTransferRestrictionMode(TransferRestrictionsMode.ONLY_MEMBERS, { from: yallTokenManager });
                    });

                    it('allow only members performing txs when the mode is ONLY_MEMBERS', async function() {
                        await yallToken.transfer(bob, ether(1), { from: alice });
                        await yallToken.approve(bob, ether(1), { from: alice });
                        await yallToken.transferFrom(alice, charlie, ether(1), { from:  bob });
                    });

                    it('should deny a whitelisted address participate in transfer call', async function() {
                        await assertRevert(
                          yallToken.transfer(alice, ether(1), { from: dan }),
                          'YALLToken: The address has no YALL token transfer permission');
                        await assertRevert(
                          yallToken.transfer(dan, ether(1), { from: alice }),
                          'YALLToken: The address has no YALL token transfer permission'
                        );
                    });

                    it('should deny whitelisted address participate in approve call', async function() {
                        await assertRevert(
                          yallToken.approve(alice, ether(1), { from: dan }),
                          'YALLToken: The address has no YALL token transfer permission');
                        await assertRevert(
                          yallToken.approve(dan, ether(1), { from: alice }),
                          'YALLToken: The address has no YALL token transfer permission'
                        );
                    });

                    it('should deny whitelisted address participate in transferFrom call', async function() {
                        await yallToken.approve(bob, ether(1), { from: alice });

                        await assertRevert(
                          yallToken.transferFrom(alice, dan, ether(1), { from: bob }),
                          'YALLToken: The address has no YALL token transfer permission');
                    });
                });

                describe('ONLY_WHITELIST mode', () => {
                    beforeEach(async function() {
                        await yallToken.mint(dan, ether(10), { from: yallMinter });
                        await yallToken.mint(eve, ether(10), { from: yallMinter });
                        await yallToken.setTransferRestrictionMode(TransferRestrictionsMode.ONLY_WHITELIST, { from: yallTokenManager });
                    });

                    it('allow only whitelisted addresses performing txs', async function() {
                        await yallToken.transfer(eve, ether(1), { from: dan });
                        await yallToken.approve(eve, ether(1), { from: dan });
                        await yallToken.transferFrom(dan, frank, ether(1), { from:  eve });
                    });

                    it('should deny members participate in transfer call', async function() {
                        await assertRevert(
                          yallToken.transfer(alice, ether(1), { from: dan }),
                          'YALLToken: The address has no YALL token transfer permission');
                        await assertRevert(
                          yallToken.transfer(dan, ether(1), { from: alice }),
                          'YALLToken: The address has no YALL token transfer permission'
                        );
                    });

                    it('should deny 3rd party participate in transfer call', async function() {
                        await assertRevert(
                          yallToken.transfer(helen, ether(1), { from: dan }),
                          'YALLToken: The address has no YALL token transfer permission');
                        await assertRevert(
                          yallToken.transfer(dan, ether(1), { from: helen }),
                          'YALLToken: The address has no YALL token transfer permission'
                        );
                    });

                    it('should deny members participate in approve call', async function() {
                        await assertRevert(
                          yallToken.approve(alice, ether(1), { from: dan }),
                          'YALLToken: The address has no YALL token transfer permission');
                        await assertRevert(
                          yallToken.approve(dan, ether(1), { from: alice }),
                          'YALLToken: The address has no YALL token transfer permission'
                        );
                    });

                    it('should deny 3rd party participate in approve call', async function() {
                        await assertRevert(
                          yallToken.approve(helen, ether(1), { from: dan }),
                          'YALLToken: The address has no YALL token transfer permission');
                        await assertRevert(
                          yallToken.approve(dan, ether(1), { from: helen }),
                          'YALLToken: The address has no YALL token transfer permission'
                        );
                    });

                    it('should deny members participate in transferFrom call', async function() {
                        await yallToken.approve(eve, ether(1), { from: dan });

                        await assertRevert(
                          yallToken.transferFrom(dan, alice, ether(1), { from: eve }),
                          'YALLToken: The address has no YALL token transfer permission');
                    });

                    it('should deny 3rd party participate in transferFrom call', async function() {
                        await yallToken.approve(eve, ether(1), { from: dan });

                        await assertRevert(
                          yallToken.transferFrom(dan, helen, ether(1), { from: eve }),
                          'YALLToken: The address has no YALL token transfer permission');
                    });
                });

                describe('ONLY_MEMBERS_AND_WHITELIST mode', () => {
                    beforeEach(async function() {
                        await yallToken.mint(bob, ether(10), { from: yallMinter });
                        await yallToken.mint(dan, ether(10), { from: yallMinter });
                        await yallToken.mint(eve, ether(10), { from: yallMinter });
                        await yallToken.setTransferRestrictionMode(TransferRestrictionsMode.ONLY_MEMBERS_AND_WHITELIST, { from: yallTokenManager });
                    });

                    it('allow txs between members and whitelisted addresses', async function() {
                        await yallToken.transfer(dan, ether(1), { from: alice });
                        await yallToken.transfer(alice, ether(1), { from: dan });
                        await yallToken.approve(eve, ether(1), { from: bob });
                        await yallToken.approve(bob, ether(1), { from: dan });
                        await yallToken.transferFrom(bob, frank, ether(1), { from:  eve });
                        await yallToken.transferFrom(dan, frank, ether(1), { from:  bob });
                    });

                    it('should deny 3rd party participate in transfer call', async function() {
                        await assertRevert(
                          yallToken.transfer(helen, ether(1), { from: dan }),
                          'YALLToken: The address has no YALL token transfer permission');
                        await assertRevert(
                          yallToken.transfer(dan, ether(1), { from: helen }),
                          'YALLToken: The address has no YALL token transfer permission'
                        );
                    });

                    it('should deny 3rd party participate in approve call', async function() {
                        await assertRevert(
                          yallToken.approve(helen, ether(1), { from: dan }),
                          'YALLToken: The address has no YALL token transfer permission');
                        await assertRevert(
                          yallToken.approve(dan, ether(1), { from: helen }),
                          'YALLToken: The address has no YALL token transfer permission'
                        );
                    });

                    it('should deny 3rd party participate in transferFrom call', async function() {
                        await yallToken.approve(eve, ether(1), { from: dan });

                        await assertRevert(
                          yallToken.transferFrom(dan, helen, ether(1), { from: eve }),
                          'YALLToken: The address has no YALL token transfer permission');
                    });
                });
            });
        });
    });
});
