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

const { approveFunction, assertRelayedCall, GSNRecipientSignatureErrorCodes } = require('../helpers')(web3);
const { buildCoinDistAndExchange } = require('../builders');

const { ether, now, increaseTime, assertRevert, assertGsnReject, getEventArg, getResTimestamp, assertErc20BalanceChanged } = require('@galtproject/solidity-test-chest')(web3);

const keccak256 = web3.utils.soliditySha3;

const OrderStatus = {
    NULL: 0,
    OPEN: 1,
    CLOSED: 2,
    CANCELLED: 3,
    VOIDED: 4
};

describe('YALLExchange Unit tests', () => {
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
    let yallToken;
    let exchange;
    let dist;

    beforeEach(async function () {
        [ ,yallToken, dist, exchange, genesisTimestamp ] = await buildCoinDistAndExchange(web3, defaultSender, {
            verifier,
            periodVolume,
            yallMinter: minter,
            yallBurner: burner,
            fundManager,
            feeManager,
            operator,
            superOperator,
            pauser,
            yallWLManager: transferWlManager
        });

        await yallToken.mint(alice, ether(baseAliceBalance), { from: minter });
        await yallToken.setTransferFee(ether('0.02'), { from: feeManager });
        await yallToken.setGsnFee(ether('1.7'), { from: feeManager });

        await yallToken.setWhitelistAddress(dist.address, true, { from: transferWlManager });
        await yallToken.setWhitelistAddress(exchange.address, true, { from: transferWlManager });
        await yallToken.setWhitelistAddress(operator, true, { from: transferWlManager });
        await yallToken.setWhitelistAddress(superOperator, true, { from: transferWlManager });

        await dist.setGsnFee(ether('4.2'));

        await exchange.addRoleTo(fundManager, 'fund_manager');
        await exchange.addRoleTo(operator, 'operator');
        await exchange.addRoleTo(superOperator, 'super_operator');
        await exchange.addRoleTo(pauser, 'pauser');

        await exchange.setDefaultMemberPeriodLimit(ether(30), { from: fundManager });
        await exchange.setTotalPeriodLimit(ether(70), { from: fundManager });
        await exchange.setGsnFee(ether('3'), { from: fundManager });

        // this will affect on dist provider too
        yallToken.contract.currentProvider.wrappedProvider.relayClient.approveFunction = approveFunction;

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
                    'YALLExchange: Only FUND_MANAGER allowed'
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
                    'YALLExchange: Only FUND_MANAGER allowed'
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
                    'YALLExchange: Only FUND_MANAGER allowed'
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
                    'YALLExchange: Only FUND_MANAGER allowed'
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
                    'YALLExchange: Only FUND_MANAGER allowed'
                );
            });
        });

        describe('#withdrawYALLs()', () => {
            beforeEach(async function() {
                await increaseTime(11);
                await dist.addMembers([keccak256('bob')], [bob], { from: verifier })
                await dist.addMembers([keccak256('alice')], [alice], { from: verifier })
                await yallToken.setWhitelistAddress(exchange.address, true, { from: transferWlManager });
                await yallToken.setWhitelistAddress(fundManager, true, { from: transferWlManager });

                await yallToken.transfer(exchange.address, ether(42), { from: alice })
            })

            it('should allow fund manager withdrawing fee', async function() {
                const fundManagerBalanceBefore = await yallToken.balanceOf(fundManager);
                await exchange.withdrawYALLs({ from: fundManager });
                const fundManagerBalanceAfter = await yallToken.balanceOf(fundManager);

                assertErc20BalanceChanged(fundManagerBalanceBefore, fundManagerBalanceAfter, ether('41.98'))

                const fortyTwo = new BigNumber(42);
                const withdrawn = new BigNumber('41.98');
                assert.equal(
                    await yallToken.balanceOf(exchange.address),
                    ether(fortyTwo.minus(withdrawn).minus(withdrawn.multipliedBy('0.0002')).toString())
                );
            });

            it('should deny non-fund manager withdrawing fee', async function() {
                await assertRevert(exchange.withdrawYALLs({ from: owner }), 'YALLExchange: Only FUND_MANAGER allowed');
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
                await assertRevert(exchange.pause({ from: verifier }), 'ACLPausable: Only PAUSER allowed');
                await assertRevert(exchange.unpause({ from: verifier }), 'ACLPausable: Only PAUSER allowed');
            });
        });
    });

    describe('Member Interface', () => {
        beforeEach(async function() {
            await dist.addMembersBeforeGenesis([memberId1, memberId2, memberId3], [bob, charlie, dan], { from: verifier });
            await increaseTime(11);
        });

        describe('#createOrder()', () => {
            it('should deny creating order with 0 amount of YALLs', async function() {
                await assertRevert(exchange.createOrder(0, { from: bob }), "YALLExchange: YALL amount can't be 0");
            });

            it('should deny creating order for non-active member', async function() {
                await dist.disableMembers([bob], { from: verifier });
                await assertRevert(exchange.createOrder(1, { from: bob }), 'YALLExchange: Member isn\'t active');
            });

            it('should deny creating an order if a contract is paused', async function() {
                await exchange.pause({ from: pauser });
                await assertRevert(exchange.createOrder(1, { from: bob }), 'Pausable: paused');
            });

            it('should deny creating an order if Limit #1 value isnt satisfied', async function() {
                await yallToken.approve(exchange.address, 3, { from: bob });
                await assertRevert(
                    exchange.createOrder(1, { from: bob, useGSN: false }),
                    'YALLExchange: exceeds Limit #1 (member volume)',
                    false
                );
            });

            describe('with enough approval and satisfied limits', () => {
                let orderId;
                let createdAt;

                beforeEach(async function() {
                    await dist.claimFunds({ from: bob });
                    await yallToken.approve(exchange.address, ether(12), { from: bob });
                    let res = await exchange.createOrder(ether(12), { from: bob });

                    orderId = getEventArg(res, 'CreateOrder', 'orderId');
                    createdAt = await getResTimestamp(res);

                    await yallToken.approve(exchange.address, ether(12), { from: bob });
                })

                it('should transfer corresponding amount to the contract balance', async function() {
                    await yallToken.approve(exchange.address, 123, { from: bob });

                    const exchangeBalanceBefore = await yallToken.balanceOf(exchange.address);
                    await exchange.createOrder(123, { from: bob });
                    const exchangeBalanceAfter = await yallToken.balanceOf(exchange.address);

                    assertErc20BalanceChanged(exchangeBalanceBefore, exchangeBalanceAfter, '123');
                });

                it('should allow creating an order using GSN', async function() {
                    await yallToken.approve(exchange.address, ether(13 + 3), { from: bob });

                    const exchangeBalanceBefore = await yallToken.balanceOf(exchange.address);
                    const bobsBalanceBefore = await yallToken.balanceOf(bob);
                    let res = await exchange.createOrder(ether(13), { from: bob, useGSN: true });
                    assertRelayedCall(res);
                    const exchangeBalanceAfter = await yallToken.balanceOf(exchange.address);
                    const bobsBalanceAfter = await yallToken.balanceOf(bob);

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
                    assert.equal(res.yallAmount, ether(12));
                    assert.equal(res.buyAmount, ether('5.04'));
                    assert.equal(res.createdAt, createdAt);
                    assert.equal(res.paymentDetails, '');
                });

                it('should update accumulators', async function() {
                    await dist.claimFunds({ from: charlie });
                    await yallToken.approve(exchange.address, ether(8), { from: bob });
                    await yallToken.approve(exchange.address, ether(7), { from: charlie });

                    const currentPeriod = await dist.getCurrentPeriodId();
                    const assertChanged = assertErc20BalanceChanged;

                    const totalExchangedYallBefore = await exchange.totalExchangedYall();
                    const yallExchangedByPeriodBefore = await exchange.yallExchangedByPeriod(currentPeriod);

                    const bobsYalExchangedByPeriodBefore = (await exchange.members(memberId1)).totalExchanged;
                    const bobsTotalExchangedYallBefore = await exchange.getMemberYallExchangedInCurrentPeriod(memberId1);

                    const charliesYallExchangedByPeriodBefore = (await exchange.members(memberId2)).totalExchanged;
                    const charliesTotalExchangedYallBefore = await exchange.getMemberYallExchangedInCurrentPeriod(memberId2);

                    await exchange.createOrder(ether(3), { from: bob });
                    await exchange.createOrder(ether(5), { from: bob });
                    await exchange.createOrder(ether(7), { from: charlie });

                    const totalExchangedYallAfter = await exchange.totalExchangedYall();
                    const yallExchangedByPeriodAfter = await exchange.yallExchangedByPeriod(currentPeriod);

                    const bobsYallExchangedByPeriodAfter = (await exchange.members(memberId1)).totalExchanged;
                    const bobsTotalExchangedYalAfter = await exchange.getMemberYallExchangedInCurrentPeriod(memberId1);

                    const charliesYallExchangedByPeriodAfter = (await exchange.members(memberId2)).totalExchanged;
                    const charliesTotalExchangedYalAfter = await exchange.getMemberYallExchangedInCurrentPeriod(memberId2);

                    assertChanged(totalExchangedYallBefore, totalExchangedYallAfter, ether(15));
                    assertChanged(yallExchangedByPeriodBefore, yallExchangedByPeriodAfter, ether(15));

                    assertChanged(bobsYalExchangedByPeriodBefore, bobsYallExchangedByPeriodAfter, ether(8));
                    assertChanged(bobsTotalExchangedYallBefore, bobsTotalExchangedYalAfter, ether(8));

                    assertChanged(charliesYallExchangedByPeriodBefore, charliesYallExchangedByPeriodAfter, ether(7));
                    assertChanged(charliesTotalExchangedYallBefore, charliesTotalExchangedYalAfter, ether(7));
                });

                describe('GSN reject', () => {
                    beforeEach(async function() {
                        assert.equal(await yallToken.balanceOf(bob), ether(63));
                        assert.equal(await exchange.gsnFee(), ether('3'));
                    })

                    it('should deny creating an order without sufficient pre-approved funds using GSN', async function() {
                        await yallToken.approve(exchange.address, 0, { from: bob });
                        assert.equal(await yallToken.allowance(bob, exchange.address), 0);

                        await assertGsnReject(
                            exchange.createOrder(ether(1), { from: bob, gasLimit: 9000000, useGSN: true }),
                            GSNRecipientSignatureErrorCodes.INSUFFICIENT_BALANCE
                        );

                        assert.equal(await yallToken.balanceOf(bob), ether(63));
                    });

                    it('should deny creating a new order without sufficient funds using GSN', async function() {
                        await yallToken.approve(dist.address, ether(12), { from: bob });
                        await yallToken.burn(bob, ether(62), { from: burner });
                        assert.equal(await yallToken.balanceOf(bob), ether(1));
                        assert.equal(await yallToken.allowance(bob, dist.address), ether(12));

                        await assertGsnReject(
                            exchange.createOrder(ether(1), { from: bob, gasLimit: 9000000, useGSN: true }),
                            GSNRecipientSignatureErrorCodes.INSUFFICIENT_BALANCE
                        );

                        assert.equal(await yallToken.balanceOf(bob), ether(1));
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

            await yallToken.approve(exchange.address, ether(12), { from: bob });
            let res = await exchange.createOrder(ether(12), { from: bob });

            orderId = getEventArg(res, 'CreateOrder', 'orderId');

            // for erc20 fees
            await yallToken.transfer(exchange.address, ether(1), { from: bob });
        });

        describe('#closeOrder()', () => {
            it('should change corresponding oder information', async function() {
                await exchange.closeOrder(orderId, 'blah', { from: operator });
                const res = await exchange.orders(orderId);
                assert.equal(res.status, OrderStatus.CLOSED);
                assert.equal(res.paymentDetails, 'blah');
            });

            it('should transfer YALLs to an operator', async function() {
                const operatorBalanceBefore = await yallToken.balanceOf(operator);
                await exchange.closeOrder(orderId, 'blah', { from: operator });
                const operatorBalanceAfter = await yallToken.balanceOf(operator);

                assertErc20BalanceChanged(operatorBalanceBefore, operatorBalanceAfter, ether(12));
            });

            it('should deny closing second time', async function() {
                await exchange.closeOrder(orderId, 'blah', { from: operator });
                await assertRevert(exchange.closeOrder(orderId, 'blah', { from: operator }), 'YALLExchange: Order should be open');
            });

            it('should deny non-operator closing an order', async function() {
                await assertRevert(exchange.closeOrder(orderId, 'blah', { from: superOperator }), 'YALLExchange: Only OPERATOR allowed');
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

            it('should transfer YALLs back to a member', async function() {
                const bobsBalanceBefore = await yallToken.balanceOf(bob);
                await exchange.cancelOrder(orderId, 'blah', { from: operator });
                const bobsBalanceAfter = await yallToken.balanceOf(bob);

                assertErc20BalanceChanged(bobsBalanceBefore, bobsBalanceAfter, ether(12));
            });

            it('should decrement accumulators', async function() {
                const currentPeriod = await dist.getCurrentPeriodId();
                const assertChanged = assertErc20BalanceChanged;

                const totalExchangedYallBefore = await exchange.totalExchangedYall();
                const yallExchangedByPeriodBefore = await exchange.yallExchangedByPeriod(currentPeriod);

                const bobsYallExchangedByPeriodBefore = (await exchange.members(memberId2)).totalExchanged;
                const bobsTotalExchangedYallBefore = await exchange.getMemberYallExchangedInCurrentPeriod(memberId2);

                await exchange.cancelOrder(orderId, 'blah', { from: operator });

                const totalExchangedYallAfter = await exchange.totalExchangedYall();
                const yallExchangedByPeriodAfter = await exchange.yallExchangedByPeriod(currentPeriod);

                const bobsYalExchangedByPeriodAfter = (await exchange.members(memberId2)).totalExchanged;
                const bobsTotalExchangedYallAfter = await exchange.getMemberYallExchangedInCurrentPeriod(memberId2);

                assertChanged(totalExchangedYallBefore, totalExchangedYallAfter, ether(-12));
                assertChanged(yallExchangedByPeriodBefore, yallExchangedByPeriodAfter, ether(-12));

                assertChanged(bobsYallExchangedByPeriodBefore, bobsYalExchangedByPeriodAfter, ether(-12));
                assertChanged(bobsTotalExchangedYallBefore, bobsTotalExchangedYallAfter, ether(-12));
            });

            it('should deny cancelling second time', async function() {
                await exchange.cancelOrder(orderId, 'blah', { from: operator });
                await assertRevert(exchange.cancelOrder(orderId, 'blah', { from: operator }), 'YALLExchange: Order should be open');
            });

            it('should deny non-operator cancelling an order', async function() {
                await assertRevert(exchange.cancelOrder(orderId, 'blah', { from: superOperator }), 'YALLExchange: Only OPERATOR allowed');
            });
        });
    });

    describe('Super Operator Interface', () => {
        let orderId;

        beforeEach(async function() {
            await dist.addMembersBeforeGenesis([memberId1, memberId2, memberId3], [alice, bob, charlie], { from: verifier });
            await increaseTime(12);

            await dist.claimFunds({ from: bob });

            await yallToken.approve(exchange.address, ether(12), { from: bob });
            let res = await exchange.createOrder(ether(12), { from: bob });

            orderId = getEventArg(res, 'CreateOrder', 'orderId');

            // for erc20 fees
            await yallToken.transfer(exchange.address, ether(1), { from: bob });
            await yallToken.transfer(superOperator, ether(1), { from: bob });
        });

        describe('#voidOrder()', () => {
            describe('for closed orders', () => {
                beforeEach(async function() {
                    await exchange.closeOrder(orderId, 'blah', { from: operator });

                    // to refund the bobs order
                    await dist.claimFunds({ from: alice });
                    await yallToken.transfer(superOperator, ether(13), { from: alice });
                });

                it('should allow a super_operator role voiding an order', async function() {
                    await yallToken.approve(exchange.address, ether(12), { from: superOperator });
                    await exchange.voidOrder(orderId, { from: superOperator })

                    const res = await exchange.orders(orderId);
                    assert.equal(res.status, OrderStatus.VOIDED);
                });

                it('should transfer a refund from super operator to an order creator', async function() {
                    const operatorBalanceBefore = await yallToken.balanceOf(superOperator);
                    const bobsBalanceBefore = await yallToken.balanceOf(bob);

                    await yallToken.approve(exchange.address, ether(12), { from: superOperator });
                    await exchange.voidOrder(orderId, { from: superOperator })

                    const operatorBalanceAfter = await yallToken.balanceOf(superOperator);
                    const bobsBalanceAfter = await yallToken.balanceOf(bob);

                    assertErc20BalanceChanged(operatorBalanceBefore, operatorBalanceAfter, ether(-12));
                    assertErc20BalanceChanged(bobsBalanceBefore, bobsBalanceAfter, ether(12));
                });

                it('should transfer a refund from super operator to a changed member address', async function() {
                    await dist.changeMyAddress(dan, { from: bob });

                    const operatorBalanceBefore = await yallToken.balanceOf(superOperator);
                    const bobsBalanceBefore = await yallToken.balanceOf(bob);
                    const dansBalanceBefore = await yallToken.balanceOf(dan);

                    await yallToken.approve(exchange.address, ether(12), { from: superOperator });
                    await exchange.voidOrder(orderId, { from: superOperator })

                    const operatorBalanceAfter = await yallToken.balanceOf(superOperator);
                    const bobsBalanceAfter = await yallToken.balanceOf(bob);
                    const dansBalanceAfter = await yallToken.balanceOf(dan);

                    assertErc20BalanceChanged(operatorBalanceBefore, operatorBalanceAfter, ether(-12));
                    assertErc20BalanceChanged(bobsBalanceBefore, bobsBalanceAfter, ether(0));
                    assertErc20BalanceChanged(dansBalanceBefore, dansBalanceAfter, ether(12));
                });

                it('should deny non-superOperator voiding an order', async function() {
                    await assertRevert(exchange.voidOrder(orderId, { from: operator }), 'YALLExchange: Only SUPER_OPERATOR allowed');
                })
            })

            it('should deny voiding an order if its not closed', async function() {
                await exchange.cancelOrder(orderId, 'blah', { from: operator });
                await assertRevert(exchange.voidOrder(orderId, { from: superOperator }), 'YALLExchange: Order should be closed');
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
                assert.equal(await exchange.calculateMaxYallToSell(memberId2), 0);
            });

            it('should equal the amount of claimed funds if not exchanged yet', async function() {
                await dist.claimFunds({ from: bob });
                assert.equal(await exchange.calculateMaxYallToSell(memberId2), ether(75));

                await increaseTime(periodLength);
                await dist.claimFunds({ from: bob });
                assert.equal(await exchange.calculateMaxYallToSell(memberId2), ether(2 * 75));

                await increaseTime(periodLength);
                await dist.claimFunds({ from: bob });
                assert.equal(await exchange.calculateMaxYallToSell(memberId2), ether(3 * 75));
            });

            it('should reduce amount for opened orders', async function() {
                await dist.claimFunds({ from: bob });

                assert.equal(await exchange.calculateMaxYallToSell(memberId2), ether(75));

                await yallToken.approve(exchange.address, ether(10), { from: bob });
                await exchange.createOrder(ether(10), { from: bob });

                assert.equal(await exchange.calculateMaxYallToSell(memberId2), ether(65));
            });

            it('should reduce amount for canceled or closed orders', async function() {
                await dist.claimFunds({ from: bob });
                await yallToken.transfer(exchange.address, ether(0.02), { from: bob });

                assert.equal(await exchange.calculateMaxYallToSell(memberId2), ether(75));

                await yallToken.approve(exchange.address, ether(10), { from: bob });
                await exchange.createOrder(ether(10), { from: bob });

                await yallToken.approve(exchange.address, ether(10), { from: bob });
                await exchange.createOrder(ether(10), { from: bob });

                assert.equal(await exchange.calculateMaxYallToSell(memberId2), ether(55));

                await exchange.closeOrder(1, 'foo', { from: operator });
                assert.equal(await exchange.calculateMaxYallToSell(memberId2), ether(55));

                await exchange.cancelOrder(2, 'bar', { from: operator });
                assert.equal(await exchange.calculateMaxYallToSell(memberId2), ether(65));
            });
        });

        describe('Limit #2', () => {
            let currentPeriodId;

            beforeEach(async function() {
                currentPeriodId = await dist.getCurrentPeriodId();
                await exchange.setDefaultMemberPeriodLimit(ether(40), { from: fundManager });
                await exchange.setCustomPeriodLimit(memberId1, ether(30), { from: fundManager });
            });

            it('should use default member limit if no personal set', async function() {
                assert.equal(
                    await exchange.checkExchangeFitsLimit2(memberId2, ether(30), currentPeriodId),
                    true
                );
                assert.equal(
                    await exchange.checkExchangeFitsLimit2(memberId2, ether(40), currentPeriodId),
                    true
                );
                assert.equal(
                    await exchange.checkExchangeFitsLimit2(memberId2, ether(41), currentPeriodId),
                    false
                );
            });

            it('should use a personal member limit if it is not 0', async function() {
                assert.equal(
                    await exchange.checkExchangeFitsLimit2(memberId1, ether(30), currentPeriodId),
                    true
                );
                assert.equal(
                    await exchange.checkExchangeFitsLimit2(memberId1, ether(31), currentPeriodId),
                    false
                );
                assert.equal(
                    await exchange.checkExchangeFitsLimit2(memberId1, ether(41), currentPeriodId),
                    false
                );
            });

            it('should not apply any limits if both personal and custom are 0', async function() {
                await exchange.setDefaultMemberPeriodLimit(ether(0), { from: fundManager });
                assert.equal(
                    await exchange.checkExchangeFitsLimit2(memberId2, ether(30), currentPeriodId),
                    true
                );
                assert.equal(
                    await exchange.checkExchangeFitsLimit2(memberId2, ether(10000000), currentPeriodId),
                    true
                );
            });
        });

        describe('Limit #3', () => {
            let currentPeriodId;

            beforeEach(async function() {
                currentPeriodId = await dist.getCurrentPeriodId();
                await exchange.setTotalPeriodLimit(ether(100), { from: fundManager });
            });

            it('should use non-zero period limit', async function() {
                assert.equal(
                    await exchange.checkExchangeFitsLimit3(ether(100), currentPeriodId),
                    true
                );
                assert.equal(
                    await exchange.checkExchangeFitsLimit3(ether(101), currentPeriodId),
                    false
                );
            });

            it('should ignore zero period limit', async function() {
                await exchange.setTotalPeriodLimit(ether(0), { from: fundManager });
                assert.equal(
                    await exchange.checkExchangeFitsLimit3(ether(100), currentPeriodId),
                    true
                );
                assert.equal(
                    await exchange.checkExchangeFitsLimit3(ether(100000), currentPeriodId),
                    true
                );
            });
        });
    });
});
