/*
 * Copyright ©️ 2020 Galt•Project Society Construction and Terraforming Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka)
 *
 * Copyright ©️ 2020 Galt•Core Blockchain Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka) by
 * [Basic Agreement](ipfs/QmaCiXUmSrP16Gz8Jdzq6AJESY1EAANmmwha15uR3c1bsS)).
 */

const { accounts, contract, web3 } = require('@openzeppelin/test-environment');
const { assert } = require('chai');
const BigNumber = require('bignumber.js');

const CoinToken = contract.fromArtifact('CoinToken');
const YALDistributor = contract.fromArtifact('YALDistributor');
const YALLReferralPayouts = contract.fromArtifact('YALLReferralPayouts');

CoinToken.numberFormat = 'String';
YALDistributor.numberFormat = 'String';
YALLReferralPayouts.numberFormat = 'String';

const { ether, now, assertRevert, assertErc20BalanceChanged } = require('@galtproject/solidity-test-chest')(web3);


describe('YALLReferralPayouts Unit tests', () => {
    const [alice, bob, charlie, superOperator, minter, operator, feeManager, transferWlManager] = accounts;

    // 7 days
    const startAfter = 10;
    let genesisTimestamp;
    let yalToken;
    let dist;
    let referral;

    beforeEach(async function () {
        genesisTimestamp = parseInt(await now(), 10) + startAfter;
        yalToken = await CoinToken.new(alice, "Coin token", "COIN", 18);
        dist = await YALDistributor.new();
        referral = await YALLReferralPayouts.new();

        referral.initialize(bob, yalToken.address);

        await yalToken.addRoleTo(minter, 'minter');
        await yalToken.addRoleTo(feeManager, 'fee_manager');
        await yalToken.addRoleTo(transferWlManager, 'transfer_wl_manager');

        await yalToken.setDistributor(dist.address);
        await yalToken.mint(alice, ether(1000), { from: minter });
        await yalToken.setTransferFee(ether('0.02'), { from: feeManager });
        await yalToken.setGsnFee(ether('1.7'), { from: feeManager });

        await yalToken.setWhitelistAddress(referral.address, true, { from: transferWlManager });
        await yalToken.setWhitelistAddress(operator, true, { from: transferWlManager });
        await yalToken.setWhitelistAddress(superOperator, true, { from: transferWlManager });
        await yalToken.setWhitelistAddress(charlie, true, { from: transferWlManager });
        await yalToken.setWhitelistAddress(alice, true, { from: transferWlManager });
    });

    it('should deny second initialization', async function() {
        await assertRevert(referral.initialize(bob, yalToken.address), 'Contract instance has already been initialized');
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
            await yalToken.transfer(referral.address, ether(100), { from: alice });
        });

        it('should allow an operator making payouts', async function() {
            const charlieBalanceBefore = await yalToken.balanceOf(charlie);
            const referralBalanceBefore = await yalToken.balanceOf(referral.address);
            const id = 123;
            const amount = ether(12);

            await referral.payout(id, charlie, amount, { from: alice });

            const charlieBalanceAfter = await yalToken.balanceOf(charlie);
            const referralBalanceAfter = await yalToken.balanceOf(referral.address);

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
