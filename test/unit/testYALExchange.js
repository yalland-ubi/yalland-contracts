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
YALExchange.numberFormat = 'String';

const { ether, now, increaseTime, assertRevert, assertGsnReject, getEventArg, getResTimestamp, assertErc20BalanceChanged } = require('@galtproject/solidity-test-chest')(web3);

const keccak256 = web3.utils.soliditySha3;

const OrderStatus = {
    NULL: 0,
    OPEN: 1,
    CLOSED: 2,
    CANCELLED: 3,
    VOIDED: 4
};

describe('YALExchange Unit tests', () => {
    const [verifier, alice, bob, charlie, dan, superOperator, pauser, minter, burner, operator, fundManager, feeManager, transferWlManager] = accounts;
    const owner = defaultSender;

    // 7 days
    const periodLength = 7 * 24 * 60 * 60;
    const periodVolume = ether(250);
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
            ether(42)
        );

        await yalToken.addRoleTo(dist.address, "minter");
        await yalToken.addRoleTo(dist.address, "burner");
        await yalToken.addRoleTo(minter, 'minter');
        await yalToken.addRoleTo(burner, 'burner');
        await yalToken.addRoleTo(feeManager, 'fee_manager');
        await yalToken.addRoleTo(transferWlManager, 'transfer_wl_manager');

        await yalToken.setDistributor(dist.address);
        await yalToken.mint(alice, ether(baseAliceBalance), { from: minter });
        await yalToken.setTransferFee(ether('0.02'), { from: feeManager });
        await yalToken.setGsnFee(ether('1.7'), { from: feeManager });

        await yalToken.setWhitelistAddress(dist.address, true, { from: transferWlManager });
        await yalToken.setWhitelistAddress(exchange.address, true, { from: transferWlManager });
        await yalToken.setWhitelistAddress(operator, true, { from: transferWlManager });
        await yalToken.setWhitelistAddress(superOperator, true, { from: transferWlManager });

        await dist.setGsnFee(ether('4.2'));

        await exchange.addRoleTo(fundManager, 'fund_manager');
        await exchange.addRoleTo(operator, 'operator');
        await exchange.addRoleTo(superOperator, 'super_operator');
        await exchange.addRoleTo(pauser, 'pauser');

        await exchange.setDefaultMemberPeriodLimit(ether(30), { from: fundManager });
        await exchange.setTotalPeriodLimit(ether(70), { from: fundManager });
        await exchange.setGsnFee(ether('3'), { from: fundManager });

        // this will affect on dist provider too
        yalToken.contract.currentProvider.wrappedProvider.relayClient.approveFunction = approveFunction;

        await deployRelayHub(web3);
        await fundRecipient(web3, { recipient: exchange.address, amount: ether(1) });
    });

    describe('FundManager Interface', () => {
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

        describe('#pause()/#unpause()', () => {
            it('should allow a pauser pausing/unpausing contract', async function() {
                assert.equal(await exchange.paused(), false);
                await exchange.pause({ from: pauser });
                assert.equal(await exchange.paused(), true);
                await exchange.unpause({ from: pauser });
                assert.equal(await exchange.paused(), false);
            });

            it('should deny non-owner pausing/unpausing contract', async function() {
                await assertRevert(exchange.pause({ from: verifier }), 'Pausable: not a pauser');
                await assertRevert(exchange.unpause({ from: verifier }), 'Pausable: not a pauser');
            });
        });
    });

    describe('Member Interface', () => {
        beforeEach(async function() {
            await dist.addMembersBeforeGenesis([memberId1, memberId2, memberId3], [bob, charlie, dan], { from: verifier });
            await increaseTime(11);
        });

        describe('#createOrder()', () => {
            it('should deny creating order with 0 amount of YALs', async function() {
                await assertRevert(exchange.createOrder(0, { from: bob }), "YALExchange: YAL amount can't be 0");
            });

            it('should deny creating order for non-active member', async function() {
                await dist.disableMembers([bob], { from: verifier });
                await assertRevert(exchange.createOrder(1, { from: bob }), 'YALExchange: Member isn\'t active');
            });

            it('should deny creating an order if a contract is paused', async function() {
                await exchange.pause({ from: pauser });
                await assertRevert(exchange.createOrder(1, { from: bob }), 'Pausable: paused');
            });

            it('should deny creating an order if Limit #1 value isnt satisfied', async function() {
                await yalToken.approve(exchange.address, 3, { from: bob });
                await assertRevert(exchange.createOrder(1, { from: bob }), 'YALExchange: YAL amount exceeds Limit #1');
            });

            describe('with enough approval and satisfied limits', () => {
                let orderId;
                let createdAt;

                beforeEach(async function() {
                    await dist.claimFunds({ from: bob });
                    await yalToken.approve(exchange.address, ether(12), { from: bob });
                    let res = await exchange.createOrder(ether(12), { from: bob });

                    orderId = getEventArg(res, 'CreateOrder', 'orderId');
                    createdAt = await getResTimestamp(res);

                    await yalToken.approve(exchange.address, ether(12), { from: bob });
                })

                it('should transfer corresponding amount to the contract balance', async function() {
                    await yalToken.approve(exchange.address, 123, { from: bob });

                    const exchangeBalanceBefore = await yalToken.balanceOf(exchange.address);
                    await exchange.createOrder(123, { from: bob });
                    const exchangeBalanceAfter = await yalToken.balanceOf(exchange.address);

                    assertErc20BalanceChanged(exchangeBalanceBefore, exchangeBalanceAfter, '123');
                });

                it('should allow creating an order using GSN', async function() {
                    await yalToken.approve(exchange.address, ether(13 + 3), { from: bob });

                    const exchangeBalanceBefore = await yalToken.balanceOf(exchange.address);
                    const bobsBalanceBefore = await yalToken.balanceOf(bob);
                    let res = await exchange.createOrder(ether(13), { from: bob, useGSN: true });
                    assertRelayedCall(res);
                    const exchangeBalanceAfter = await yalToken.balanceOf(exchange.address);
                    const bobsBalanceAfter = await yalToken.balanceOf(bob);

                    const total = (new BigNumber(ether(13 + 3)));
                    const feeRate = new BigNumber('0.02');
                    assertErc20BalanceChanged(
                        exchangeBalanceBefore,
                        exchangeBalanceAfter,
                        total
                            .minus(total.multipliedBy(feeRate).dividedBy(100))
                            .toString()
                    );
                    assertErc20BalanceChanged(bobsBalanceBefore, bobsBalanceAfter, ether(-16));
                });

                it('should increment order id by 1 on each call', async function() {
                    let res = await exchange.createOrder(1, { from: bob });
                    assert.equal(getEventArg(res, 'CreateOrder', 'orderId'), 2);

                    res = await exchange.createOrder(1, { from: bob });
                    assert.equal(getEventArg(res, 'CreateOrder', 'orderId'), 3);

                    res = await exchange.createOrder(1, { from: bob });
                    assert.equal(getEventArg(res, 'CreateOrder', 'orderId'), 4);
                });

                it('should fill required fields after creation', async function() {
                    let res = await exchange.orders(orderId);
                    assert.equal(res.status, OrderStatus.OPEN);
                    assert.equal(res.memberId, memberId1);
                    assert.equal(res.yalAmount, ether(12));
                    assert.equal(res.buyAmount, ether('5.04'));
                    assert.equal(res.createdAt, createdAt);
                    assert.equal(res.paymentDetails, '');
                });

                it('should update accumulators', async function() {
                    await dist.claimFunds({ from: charlie });
                    await yalToken.approve(exchange.address, ether(8), { from: bob });
                    await yalToken.approve(exchange.address, ether(7), { from: charlie });

                    const currentPeriod = await dist.getCurrentPeriodId();
                    const assertChanged = assertErc20BalanceChanged;

                    const totalExchangedYalBefore = await exchange.totalExchangedYal();
                    const yalExchangedByPeriodBefore = await exchange.yalExchangedByPeriod(currentPeriod);

                    const bobsYalExchangedByPeriodBefore = (await exchange.members(memberId1)).totalExchanged;
                    const bobsTotalExchangedYalBefore = await exchange.getMemberYallExchangedInCurrentPeriod(memberId1);

                    const charliesYalExchangedByPeriodBefore = (await exchange.members(memberId2)).totalExchanged;
                    const charliesTotalExchangedYalBefore = await exchange.getMemberYallExchangedInCurrentPeriod(memberId2);

                    await exchange.createOrder(ether(3), { from: bob });
                    await exchange.createOrder(ether(5), { from: bob });
                    await exchange.createOrder(ether(7), { from: charlie });

                    const totalExchangedYalAfter = await exchange.totalExchangedYal();
                    const yalExchangedByPeriodAfter = await exchange.yalExchangedByPeriod(currentPeriod);

                    const bobsYalExchangedByPeriodAfter = (await exchange.members(memberId1)).totalExchanged;
                    const bobsTotalExchangedYalAfter = await exchange.getMemberYallExchangedInCurrentPeriod(memberId1);

                    const charliesYalExchangedByPeriodAfter = (await exchange.members(memberId2)).totalExchanged;
                    const charliesTotalExchangedYalAfter = await exchange.getMemberYallExchangedInCurrentPeriod(memberId2);

                    assertChanged(totalExchangedYalBefore, totalExchangedYalAfter, ether(15));
                    assertChanged(yalExchangedByPeriodBefore, yalExchangedByPeriodAfter, ether(15));

                    assertChanged(bobsYalExchangedByPeriodBefore, bobsYalExchangedByPeriodAfter, ether(8));
                    assertChanged(bobsTotalExchangedYalBefore, bobsTotalExchangedYalAfter, ether(8));

                    assertChanged(charliesYalExchangedByPeriodBefore, charliesYalExchangedByPeriodAfter, ether(7));
                    assertChanged(charliesTotalExchangedYalBefore, charliesTotalExchangedYalAfter, ether(7));
                });

                describe('GSN reject', () => {
                    beforeEach(async function() {
                        assert.equal(await yalToken.balanceOf(bob), ether(63));
                        assert.equal(await exchange.gsnFee(), ether('3'));
                    })

                    it('should deny creating an order without sufficient pre-approved funds using GSN', async function() {
                        await yalToken.approve(exchange.address, 0, { from: bob });
                        assert.equal(await yalToken.allowance(bob, exchange.address), 0);

                        await assertGsnReject(
                            exchange.createOrder(ether(1), { from: bob, gasLimit: 9000000, useGSN: true }),
                            GSNRecipientSignatureErrorCodes.INSUFFICIENT_BALANCE
                        );

                        assert.equal(await yalToken.balanceOf(bob), ether(63));
                    });

                    it('should deny creating a new order without sufficient funds using GSN', async function() {
                        await yalToken.approve(dist.address, ether(12), { from: bob });
                        await yalToken.burn(bob, ether(62), { from: burner });
                        assert.equal(await yalToken.balanceOf(bob), ether(1));
                        assert.equal(await yalToken.allowance(bob, dist.address), ether(12));

                        await assertGsnReject(
                            exchange.createOrder(ether(1), { from: bob, gasLimit: 9000000, useGSN: true }),
                            GSNRecipientSignatureErrorCodes.INSUFFICIENT_BALANCE
                        );

                        assert.equal(await yalToken.balanceOf(bob), ether(1));
                    });
                })
            });
        });
    });

    describe('Operator Interface', () => {
        let orderId;

        beforeEach(async function() {
            await dist.addMembersBeforeGenesis([memberId1, memberId2, memberId3], [alice, bob, charlie], { from: verifier });
            await increaseTime(12);

            await dist.claimFunds({ from: bob });

            await yalToken.approve(exchange.address, ether(12), { from: bob });
            let res = await exchange.createOrder(ether(12), { from: bob });

            orderId = getEventArg(res, 'CreateOrder', 'orderId');

            // for erc20 fees
            await yalToken.transfer(exchange.address, ether(1), { from: bob });
        });

        describe('#closeOrder()', () => {
            it('should change corresponding oder information', async function() {
                await exchange.closeOrder(orderId, 'blah', { from: operator });
                const res = await exchange.orders(orderId);
                assert.equal(res.status, OrderStatus.CLOSED);
                assert.equal(res.paymentDetails, 'blah');
            });

            it('should transfer YALs to an operator', async function() {
                const operatorBalanceBefore = await yalToken.balanceOf(operator);
                await exchange.closeOrder(orderId, 'blah', { from: operator });
                const operatorBalanceAfter = await yalToken.balanceOf(operator);

                assertErc20BalanceChanged(operatorBalanceBefore, operatorBalanceAfter, ether(12));
            });

            it('should deny closing second time', async function() {
                await exchange.closeOrder(orderId, 'blah', { from: operator });
                await assertRevert(exchange.closeOrder(orderId, 'blah', { from: operator }), 'YALExchange: Order should be open');
            });

            it('should deny non-operator closing an order', async function() {
                await assertRevert(exchange.closeOrder(orderId, 'blah', { from: superOperator }), 'YALExchange: Only operator role allowed');
            });
        });

        describe('#cancelOrder()', () => {
            it('should change corresponding order information', async function() {
                let res = await exchange.cancelOrder(orderId, 'blah', { from: operator });
                assert.equal(getEventArg(res, 'CancelOrder', 'reason'), 'blah');
                res = await exchange.orders(orderId);
                assert.equal(res.status, OrderStatus.CANCELLED);
                assert.equal(res.paymentDetails, '');
            });

            it('should transfer YALs back to a member', async function() {
                const bobsBalanceBefore = await yalToken.balanceOf(bob);
                await exchange.cancelOrder(orderId, 'blah', { from: operator });
                const bobsBalanceAfter = await yalToken.balanceOf(bob);

                assertErc20BalanceChanged(bobsBalanceBefore, bobsBalanceAfter, ether(12));
            });

            it('should decrement accumulators', async function() {
                const currentPeriod = await dist.getCurrentPeriodId();
                const assertChanged = assertErc20BalanceChanged;

                const totalExchangedYalBefore = await exchange.totalExchangedYal();
                const yalExchangedByPeriodBefore = await exchange.yalExchangedByPeriod(currentPeriod);

                const bobsYalExchangedByPeriodBefore = (await exchange.members(memberId2)).totalExchanged;
                const bobsTotalExchangedYalBefore = await exchange.getMemberYallExchangedInCurrentPeriod(memberId2);

                await exchange.cancelOrder(orderId, 'blah', { from: operator });

                const totalExchangedYalAfter = await exchange.totalExchangedYal();
                const yalExchangedByPeriodAfter = await exchange.yalExchangedByPeriod(currentPeriod);

                const bobsYalExchangedByPeriodAfter = (await exchange.members(memberId2)).totalExchanged;
                const bobsTotalExchangedYalAfter = await exchange.getMemberYallExchangedInCurrentPeriod(memberId2);

                assertChanged(totalExchangedYalBefore, totalExchangedYalAfter, ether(-12));
                assertChanged(yalExchangedByPeriodBefore, yalExchangedByPeriodAfter, ether(-12));

                assertChanged(bobsYalExchangedByPeriodBefore, bobsYalExchangedByPeriodAfter, ether(-12));
                assertChanged(bobsTotalExchangedYalBefore, bobsTotalExchangedYalAfter, ether(-12));
            });

            it('should deny cancelling second time', async function() {
                await exchange.cancelOrder(orderId, 'blah', { from: operator });
                await assertRevert(exchange.cancelOrder(orderId, 'blah', { from: operator }), 'YALExchange: Order should be open');
            });

            it('should deny non-operator cancelling an order', async function() {
                await assertRevert(exchange.cancelOrder(orderId, 'blah', { from: superOperator }), 'YALExchange: Only operator role allowed');
            });
        });
    });

    describe('Super Operator Interface', () => {
        let orderId;

        beforeEach(async function() {
            await dist.addMembersBeforeGenesis([memberId1, memberId2, memberId3], [alice, bob, charlie], { from: verifier });
            await increaseTime(12);

            await dist.claimFunds({ from: bob });

            await yalToken.approve(exchange.address, ether(12), { from: bob });
            let res = await exchange.createOrder(ether(12), { from: bob });

            orderId = getEventArg(res, 'CreateOrder', 'orderId');

            // for erc20 fees
            await yalToken.transfer(exchange.address, ether(1), { from: bob });
            await yalToken.transfer(superOperator, ether(1), { from: bob });
        });

        describe('#voidOrder()', () => {
            describe('for closed orders', () => {
                beforeEach(async function() {
                    await exchange.closeOrder(orderId, 'blah', { from: operator });

                    // to refund the bobs order
                    await dist.claimFunds({ from: alice });
                    await yalToken.transfer(superOperator, ether(13), { from: alice });
                });

                it('should allow a super_operator role voiding an order', async function() {
                    await yalToken.approve(exchange.address, ether(12), { from: superOperator });
                    await exchange.voidOrder(orderId, { from: superOperator })

                    const res = await exchange.orders(orderId);
                    assert.equal(res.status, OrderStatus.VOIDED);
                });

                it('should transfer a refund from super operator to an order creator', async function() {
                    const operatorBalanceBefore = await yalToken.balanceOf(superOperator);
                    const bobsBalanceBefore = await yalToken.balanceOf(bob);

                    await yalToken.approve(exchange.address, ether(12), { from: superOperator });
                    await exchange.voidOrder(orderId, { from: superOperator })

                    const operatorBalanceAfter = await yalToken.balanceOf(superOperator);
                    const bobsBalanceAfter = await yalToken.balanceOf(bob);

                    assertErc20BalanceChanged(operatorBalanceBefore, operatorBalanceAfter, ether(-12));
                    assertErc20BalanceChanged(bobsBalanceBefore, bobsBalanceAfter, ether(12));
                });

                it('should transfer a refund from super operator to a changed member address', async function() {
                    await dist.changeMyAddress(dan, { from: bob });

                    const operatorBalanceBefore = await yalToken.balanceOf(superOperator);
                    const bobsBalanceBefore = await yalToken.balanceOf(bob);
                    const dansBalanceBefore = await yalToken.balanceOf(dan);

                    await yalToken.approve(exchange.address, ether(12), { from: superOperator });
                    await exchange.voidOrder(orderId, { from: superOperator })

                    const operatorBalanceAfter = await yalToken.balanceOf(superOperator);
                    const bobsBalanceAfter = await yalToken.balanceOf(bob);
                    const dansBalanceAfter = await yalToken.balanceOf(dan);

                    assertErc20BalanceChanged(operatorBalanceBefore, operatorBalanceAfter, ether(-12));
                    assertErc20BalanceChanged(bobsBalanceBefore, bobsBalanceAfter, ether(0));
                    assertErc20BalanceChanged(dansBalanceBefore, dansBalanceAfter, ether(12));
                });

                it('should deny non-superOperator voiding an order', async function() {
                    await assertRevert(exchange.voidOrder(orderId, { from: operator }), 'YALExchange: Only super operator role allowed');
                })
            })

            it('should deny voiding an order if its not closed', async function() {
                await exchange.cancelOrder(orderId, 'blah', { from: operator });
                await assertRevert(exchange.voidOrder(orderId, { from: superOperator }), 'YALExchange: Order should be closed');
            })
        });
    });

    describe('Limits', () => {
        beforeEach(async function() {
            await dist.addMembersBeforeGenesis([memberId1, memberId2, memberId3], [alice, bob, charlie], { from: verifier });
            await increaseTime(12);
        });

        describe('Limit #1', () => {
            it('should be 0 if there are no funds claimed yet', async function() {
                assert.equal(await exchange.calculateMaxYalToSell(memberId2), 0);
            });

            it('should equal the amount of claimed funds if not exchanged yet', async function() {
                await dist.claimFunds({ from: bob });
                assert.equal(await exchange.calculateMaxYalToSell(memberId2), ether(75));

                await increaseTime(periodLength);
                await dist.claimFunds({ from: bob });
                assert.equal(await exchange.calculateMaxYalToSell(memberId2), ether(2 * 75));

                await increaseTime(periodLength);
                await dist.claimFunds({ from: bob });
                assert.equal(await exchange.calculateMaxYalToSell(memberId2), ether(3 * 75));
            });

            it('should reduce amount for opened orders', async function() {
                await dist.claimFunds({ from: bob });

                assert.equal(await exchange.calculateMaxYalToSell(memberId2), ether(75));

                await yalToken.approve(exchange.address, ether(10), { from: bob });
                await exchange.createOrder(ether(10), { from: bob });

                assert.equal(await exchange.calculateMaxYalToSell(memberId2), ether(65));
            });

            it('should reduce amount for canceled or closed orders', async function() {
                await dist.claimFunds({ from: bob });
                await yalToken.transfer(exchange.address, ether(0.02), { from: bob });

                assert.equal(await exchange.calculateMaxYalToSell(memberId2), ether(75));

                await yalToken.approve(exchange.address, ether(10), { from: bob });
                await exchange.createOrder(ether(10), { from: bob });

                await yalToken.approve(exchange.address, ether(10), { from: bob });
                await exchange.createOrder(ether(10), { from: bob });

                assert.equal(await exchange.calculateMaxYalToSell(memberId2), ether(55));

                await exchange.closeOrder(1, 'foo', { from: operator });
                assert.equal(await exchange.calculateMaxYalToSell(memberId2), ether(55));

                await exchange.cancelOrder(2, 'bar', { from: operator });
                assert.equal(await exchange.calculateMaxYalToSell(memberId2), ether(65));
            });
        });
    });
});
