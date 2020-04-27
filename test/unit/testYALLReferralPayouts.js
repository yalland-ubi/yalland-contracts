/*
 * Copyright ©️ 2020 Galt•Project Society Construction and Terraforming Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka)
 *
 * Copyright ©️ 2020 Galt•Core Blockchain Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka) by
 * [Basic Agreement](ipfs/QmaCiXUmSrP16Gz8Jdzq6AJESY1EAANmmwha15uR3c1bsS)).
 */

const { accounts, contract, defaultSender, web3 } = require('@openzeppelin/test-environment');
const { assert } = require('chai');
const BigNumber = require('bignumber.js');
const { buildCoinDistAndExchange } = require('../builders');

const YALLToken = contract.fromArtifact('YALLToken');
const YALLDistributor = contract.fromArtifact('YALLDistributor');
const YALLReferralPayouts = contract.fromArtifact('YALLReferralPayouts');

YALLToken.numberFormat = 'String';
YALLDistributor.numberFormat = 'String';
YALLReferralPayouts.numberFormat = 'String';

const { ether, now, assertRevert, assertErc20BalanceChanged } = require('@galtproject/solidity-test-chest')(web3);


describe('YALLReferralPayouts Unit tests', () => {
    const [alice, bob, charlie, superOperator, minter, operator, feeManager, transferWlManager] = accounts;

    // 7 days
    const startAfter = 10;
    let genesisTimestamp;
    let yallToken;
    let dist;
    let referral;

    beforeEach(async function () {
        [ ,yallToken, dist, , genesisTimestamp ] = await buildCoinDistAndExchange(web3, defaultSender, {
            governance: alice,
            yallMinter: minter,
            feeManager,
            yallWLManager: transferWlManager,
            periodVolume: ether(250)
        });

        referral = await YALLReferralPayouts.new();

        referral.initialize(bob, yallToken.address);

        await yallToken.mint(alice, ether(1000), { from: minter });
        await yallToken.setTransferFee(ether('0.02'), { from: feeManager });
        await yallToken.setGsnFee(ether('1.7'), { from: feeManager });

        await yallToken.setWhitelistAddress(referral.address, true, { from: transferWlManager });
        await yallToken.setWhitelistAddress(operator, true, { from: transferWlManager });
        await yallToken.setWhitelistAddress(superOperator, true, { from: transferWlManager });
        await yallToken.setWhitelistAddress(charlie, true, { from: transferWlManager });
        await yallToken.setWhitelistAddress(alice, true, { from: transferWlManager });
    });

    it('should deny second initialization', async function() {
        await assertRevert(referral.initialize(bob, yallToken.address), 'Contract instance has already been initialized');
    })

    describe('Owner Interface', () => {
        it('should allow an owner managing operator roles', async function() {
            assert.equal(await referral.hasRole(alice, 'blah'), false);
            await referral.addRoleTo(alice, 'blah', { from: bob });
            assert.equal(await referral.hasRole(alice, 'blah'), true);
            await referral.removeRoleFrom(alice, 'blah', { from: bob });
            assert.equal(await referral.hasRole(alice, 'blah'), false);
        });
    });

    describe('Operator Interface', () => {
        beforeEach(async function() {
            await referral.addRoleTo(alice, 'operator', { from: bob });
            await yallToken.transfer(referral.address, ether(100), { from: alice });
        });

        it('should allow an operator making payouts', async function() {
            const charlieBalanceBefore = await yallToken.balanceOf(charlie);
            const referralBalanceBefore = await yallToken.balanceOf(referral.address);
            const id = 123;
            const amount = ether(12);

            await referral.payout(id, charlie, amount, { from: alice });

            const charlieBalanceAfter = await yallToken.balanceOf(charlie);
            const referralBalanceAfter = await yallToken.balanceOf(referral.address);

            const changed = (new BigNumber(0))
                .minus((new BigNumber(ether(12))))
                .minus((new BigNumber(ether(12))).multipliedBy('0.0002'))
                .toString();

            assertErc20BalanceChanged(charlieBalanceBefore, charlieBalanceAfter, amount);
            assertErc20BalanceChanged(referralBalanceBefore, referralBalanceAfter, changed);
        });

        it('should deny payouts with the same id', async function() {
            await referral.payout(123, charlie, ether(12), { from: alice });
            await assertRevert(
                referral.payout(123, charlie, ether(12), { from: alice }),
                'YALLReferralPayouts: Payout already registered'
            );
            await referral.payout(124, charlie, ether(12), { from: alice });
        });
    });
});
