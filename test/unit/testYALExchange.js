/*
 * Copyright ©️ 2020 Galt•Project Society Construction and Terraforming Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka)
 *
 * Copyright ©️ 2020 Galt•Core Blockchain Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka) by
 * [Basic Agreement](ipfs/QmaCiXUmSrP16Gz8Jdzq6AJESY1EAANmmwha15uR3c1bsS)).
 */

const { accounts, contract, web3, defaultSender } = require('@openzeppelin/test-environment');
const { assert } = require('chai');
const BigNumber = require('bignumber.js');
const {
    deployRelayHub,
    fundRecipient,
} = require('@openzeppelin/gsn-helpers');

const CoinToken = contract.fromArtifact('CoinToken');
const YALDistributor = contract.fromArtifact('YALDistributor');
const YALExchange = contract.fromArtifact('YALExchange');
const { approveFunction, assertRelayedCall, GSNRecipientSignatureErrorCodes } = require('../helpers')(web3);

CoinToken.numberFormat = 'String';
YALDistributor.numberFormat = 'String';

const { ether, now, int, increaseTime, assertRevert, assertGsnReject, zeroAddress, getResTimestamp, assertErc20BalanceChanged } = require('@galtproject/solidity-test-chest')(web3);

const keccak256 = web3.utils.soliditySha3;

describe('YALExchange Unit tests', () => {
    const [verifier, alice, bob, charlie, dan, eve, minter, burner, fundManager, feeManager, transferWlManager] = accounts;
    const owner = defaultSender;

    // 7 days
    const periodLength = 7 * 24 * 60 * 60;
    const periodVolume = ether(250 * 1000);
    const verifierRewardShare = ether(10);
    const baseAliceBalance = 10000000;
    const feePercent = 0.02;
    const startAfter = 10;
    const memberId1 = keccak256('bob');
    const memberId2 = keccak256('charlie');
    const memberId3 = keccak256('dan');
    const memberId4 = keccak256('eve');
    let genesisTimestamp;
    let yalToken;
    let exchange;
    let dist;

    beforeEach(async function () {
        genesisTimestamp = parseInt(await now(), 10) + startAfter;
        yalToken = await CoinToken.new(alice, "Coin token", "COIN", 18);
        dist = await YALDistributor.new();
        exchange = await YALExchange.new();

        await dist.initialize(
            periodVolume,
            verifier,
            verifierRewardShare,

            yalToken.address,
            periodLength,
            genesisTimestamp
        );

        await exchange.initialize(
            defaultSender,
            dist.address,
            yalToken.address,
            // defaultExchangeRate numerator
            ether(19)
        );

        await yalToken.addRoleTo(dist.address, "minter");
        await yalToken.addRoleTo(dist.address, "burner");
        await yalToken.addRoleTo(minter, 'minter');
        await yalToken.addRoleTo(feeManager, 'fee_manager');
        await yalToken.addRoleTo(transferWlManager, 'transfer_wl_manager');

        await yalToken.setDistributor(dist.address);
        await yalToken.mint(alice, ether(baseAliceBalance), { from: minter });
        await yalToken.setTransferFee(ether('0.02'), { from: feeManager });
        await yalToken.setGsnFee(ether('1.7'), { from: feeManager });

        await yalToken.setWhitelistAddress(dist.address, true, { from: transferWlManager });
        await yalToken.setWhitelistAddress(exchange.address, true, { from: transferWlManager });

        await dist.setGsnFee(ether('4.2'));

        await exchange.addRoleTo(fundManager, 'fund_manager');

        // this will affect on dist provider too
        yalToken.contract.currentProvider.wrappedProvider.relayClient.approveFunction = approveFunction;

        await deployRelayHub(web3);
        await fundRecipient(web3, { recipient: dist.address, amount: ether(1) });
    });

    describe.only('FundManager Interface', () => {
        describe('#setDefaultExchangeRate()', () => {
            it('should allow a fund manager setting the default exchange rate', async function() {
                await exchange.setDefaultExchangeRate(ether(123), { from: fundManager });
                assert.equal(await exchange.defaultExchangeRate(), ether(123));
            });

            it('should deny 0 exchange rate', async function() {
                await assertRevert(
                    exchange.setDefaultExchangeRate(0, { from: fundManager }),
                    'Default rate can\'t be 0'
                );
            });

            it('should deny a non-fund manager setting the default exchange rate', async function() {
                await assertRevert(
                    exchange.setDefaultExchangeRate(ether(123), { from: owner }),
                    'Only fund manager role allowed'
                );
            });
        });

        describe('#setCustomExchangeRate()', () => {
            it('should allow a fund manager setting the default exchange rate', async function() {
                await exchange.setCustomExchangeRate(memberId2, ether(42), { from: fundManager });
                assert.equal(await exchange.getCustomExchangeRate(memberId2), ether(42));
            });

            it('should deny a non-fund manager setting the default exchange rate', async function() {
                await assertRevert(
                    exchange.setCustomExchangeRate(memberId2, ether(123), { from: owner }),
                    'Only fund manager role allowed'
                );
            });
        });

        describe('#setTotalPeriodLimit()', () => {
            it('should allow a fund manager setting the default exchange rate', async function() {
                await exchange.setTotalPeriodLimit(ether(123), { from: fundManager });
                assert.equal(await exchange.totalPeriodLimit(), ether(123));
            });

            it('should deny a non-fund manager setting the default exchange rate', async function() {
                await assertRevert(
                    exchange.setTotalPeriodLimit(ether(123), { from: owner }),
                    'Only fund manager role allowed'
                );
            });
        });

        describe('#setDefaultMemberPeriodLimit()', () => {
            it('should allow a fund manager setting the default member limit', async function() {
                await exchange.setDefaultMemberPeriodLimit(ether(123), { from: fundManager });
                assert.equal(await exchange.defaultMemberPeriodLimit(), ether(123));
            });

            it('should deny a non-fund manager setting the default member limit', async function() {
                await assertRevert(
                    exchange.setDefaultMemberPeriodLimit(ether(123), { from: owner }),
                    'Only fund manager role allowed'
                );
            });
        });

        describe('#setCustomPeriodLimit()', () => {
            it('should allow a fund manager setting the custom period limit', async function() {
                await exchange.setCustomPeriodLimit(memberId2, ether(42), { from: fundManager });
                assert.equal(await exchange.getCustomPeriodLimit(memberId2), ether(42));
            });

            it('should deny a non-fund manager setting the custom period limit', async function() {
                await assertRevert(
                    exchange.setCustomPeriodLimit(memberId2, ether(123), { from: owner }),
                    'Only fund manager role allowed'
                );
            });
        });

        describe('#withdrawYALs()', () => {
            beforeEach(async function() {
                await increaseTime(11);
                await dist.addMembers([keccak256('bob')], [bob], { from: verifier })
                await dist.addMembers([keccak256('alice')], [alice], { from: verifier })
                await yalToken.setWhitelistAddress(exchange.address, true, { from: transferWlManager });
                await yalToken.setWhitelistAddress(fundManager, true, { from: transferWlManager });

                await yalToken.transfer(exchange.address, ether(42), { from: alice })
            })

            it('should allow fund manager withdrawing fee', async function() {
                const fundManagerBalanceBefore = await yalToken.balanceOf(fundManager);
                await exchange.withdrawYALs({ from: fundManager });
                const fundManagerBalanceAfter = await yalToken.balanceOf(fundManager);

                assertErc20BalanceChanged(fundManagerBalanceBefore, fundManagerBalanceAfter, ether('41.98'))

                const fortyTwo = new BigNumber(42);
                const withdrawn = new BigNumber('41.98');
                assert.equal(
                    await yalToken.balanceOf(exchange.address),
                    ether(fortyTwo.minus(withdrawn).minus(withdrawn.multipliedBy('0.0002')).toString())
                );
            });

            it('should deny non-fund manager withdrawing fee', async function() {
                await assertRevert(exchange.withdrawYALs({ from: owner }), 'Only fund manager role allowed');
            });
        });

        describe.skip('#pause()/#unpause()', () => {
            it('should allow the owner pausing/unpausing contract', async function() {
                assert.equal(await dist.paused(), false);
                await dist.pause();
                assert.equal(await dist.paused(), true);
                await dist.unpause();
                assert.equal(await dist.paused(), false);
            });

            it('should deny non-owner pausing/unpausing contract', async function() {
                await assertRevert(dist.pause({ from: verifier }), 'Ownable: caller is not the owner');
                await assertRevert(dist.unpause({ from: verifier }), 'Ownable: caller is not the owner');
            });
        });
    });
});
