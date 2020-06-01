/*
 * Copyright ©️ 2020 Galt•Project Society Construction and Terraforming Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka)
 *
 * Copyright ©️ 2020 Galt•Core Blockchain Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka) by
 * [Basic Agreement](ipfs/QmaCiXUmSrP16Gz8Jdzq6AJESY1EAANmmwha15uR3c1bsS)).
 */

const { accounts, web3, defaultSender } = require('@openzeppelin/test-environment');
const { assert } = require('chai');
const { deployRelayHub, fundRecipient } = require('@openzeppelin/gsn-helpers');
const { ether, increaseTime, assertRevert, getEventArg } = require('@galtproject/solidity-test-chest')(web3);
const { buildCoinDistAndExchange } = require('./builders');

const { approveFunction } = require('./helpers')(web3);

const OrderStatus = {
  NULL: 0,
  OPEN: 1,
  CLOSED: 2,
  CANCELLED: 3,
  VOIDED: 4,
};

const keccak256 = web3.utils.soliditySha3;

describe('YALLExchange Integration tests', () => {
  const [
    distributorVerifier,
    alice,
    bob,
    charlie,
    dan,
    gsnFeeCollector,
    feeCollector,
    yallMinter,
    exchangeOperator,
    exchangeSuperOperator,
    exchangeManager,
    feeManager,
    yallTokenManager,
  ] = accounts;

  let yallToken;
  let dist;
  let exchange;
  const periodLength = 7 * 24 * 60 * 60;
  const memberId1 = keccak256('bob');
  const memberId2 = keccak256('charlie');
  const memberId3 = keccak256('dan');

  beforeEach(async function () {
    ({ yallToken, dist, exchange } = await buildCoinDistAndExchange(defaultSender, {
      distributorVerifier,
      yallMinter,
      feeManager,
      feeCollector,
      gsnFeeCollector,
      exchangeManager,
      exchangeOperator,
      exchangeSuperOperator,
      yallTokenManager,
      disableEmission: true,
      disableCommission: true,
    }));

    await yallToken.setTransferFee(ether('0.02'), { from: feeManager });
    await yallToken.setGsnFee(ether('1.7'), { from: feeManager });

    await yallToken.setCanTransferWhitelistAddress(dist.address, true, { from: yallTokenManager });
    await yallToken.setCanTransferWhitelistAddress(exchange.address, true, { from: yallTokenManager });
    await yallToken.setCanTransferWhitelistAddress(exchangeOperator, true, { from: yallTokenManager });
    await yallToken.setCanTransferWhitelistAddress(exchangeSuperOperator, true, { from: yallTokenManager });
    await yallToken.setCanTransferWhitelistAddress(dan, true, { from: yallTokenManager });

    await dist.addMembersBeforeGenesis([memberId1], [alice], { from: distributorVerifier });
    await dist.addMembersBeforeGenesis([memberId2], [bob], { from: distributorVerifier });

    await dist.setGsnFee(ether('4.2'), { from: feeManager });

    await exchange.setDefaultMemberPeriodLimit(ether(30), { from: exchangeManager });
    await exchange.setTotalPeriodLimit(ether(70), { from: exchangeManager });

    await yallToken.mint(dan, ether(11), { from: yallMinter });
    await yallToken.transfer(exchange.address, ether(10), { from: dan });

    // this will affect on dist provider too
    yallToken.contract.currentProvider.wrappedProvider.relayClient.approveFunction = approveFunction;

    await deployRelayHub(web3);
    await fundRecipient(web3, { recipient: dist.address, amount: ether(1) });

    await increaseTime(12);
  });

  it('should create/close/void order successfully', async function () {
    await dist.claimFunds({ from: alice });

    assert.equal(await yallToken.balanceOf(alice), ether(112.5));

    await exchange.setDefaultExchangeRate(ether(350), { from: exchangeManager });

    // Create an order
    await yallToken.approve(exchange.address, ether(12), { from: alice });
    let res = await exchange.createOrder(ether(12), { from: alice });
    const orderId = getEventArg(res, 'CreateOrder', 'orderId');

    assert.equal(orderId, 1);

    res = await exchange.orders(orderId);

    assert.equal(res.status, OrderStatus.OPEN);
    assert.equal(res.memberId, memberId1);

    // Close an order
    await assertRevert(
      exchange.closeOrder(orderId, 'foo', { from: exchangeSuperOperator }),
      'YALLExchange: Only EXCHANGE_OPERATOR allowed'
    );
    await assertRevert(
      exchange.closeOrder(orderId, 'foo', { from: alice }),
      'YALLExchange: Only EXCHANGE_OPERATOR allowed'
    );
    await exchange.closeOrder(orderId, 'foo', { from: exchangeOperator });

    res = await exchange.orders(orderId);
    assert.equal(res.status, OrderStatus.CLOSED);

    // Can't close again
    await assertRevert(
      exchange.closeOrder(orderId, 'foo', { from: exchangeOperator }),
      'YALLExchange: Order should be open'
    );

    // Can't cancel
    await assertRevert(
      exchange.cancelOrder(orderId, 'foo', { from: exchangeOperator }),
      'YALLExchange: Order should be open'
    );

    // But can void
    await assertRevert(
      exchange.voidOrder(orderId, { from: exchangeOperator }),
      'YALLExchange: Only EXCHANGE_SUPER_OPERATOR allowed'
    );
    await yallToken.mint(exchangeSuperOperator, ether(12), { from: yallMinter });
    await yallToken.approve(exchange.address, ether(12), { from: exchangeSuperOperator });
    await exchange.voidOrder(orderId, { from: exchangeSuperOperator });

    res = await exchange.orders(orderId);
    assert.equal(res.status, OrderStatus.VOIDED);
  });

  it('should create/cancel order successfully', async function () {
    await dist.claimFunds({ from: alice });

    assert.equal(await yallToken.balanceOf(alice), ether(112.5));

    await exchange.setDefaultExchangeRate(ether(350), { from: exchangeManager });

    // Create an order
    await yallToken.approve(exchange.address, ether(12), { from: alice });
    let res = await exchange.createOrder(ether(12), { from: alice });
    const orderId = getEventArg(res, 'CreateOrder', 'orderId');

    assert.equal(orderId, 1);

    res = await exchange.orders(orderId);
    assert.equal(res.status, OrderStatus.OPEN);

    // Close an order
    await assertRevert(
      exchange.closeOrder(orderId, 'foo', { from: exchangeSuperOperator }),
      'YALLExchange: Only EXCHANGE_OPERATOR allowed'
    );
    await assertRevert(
      exchange.closeOrder(orderId, 'foo', { from: alice }),
      'YALLExchange: Only EXCHANGE_OPERATOR allowed'
    );
    await exchange.cancelOrder(orderId, 'foo', { from: exchangeOperator });

    res = await exchange.orders(orderId);
    assert.equal(res.status, OrderStatus.CANCELLED);

    // Can't cancel again
    await assertRevert(
      exchange.cancelOrder(orderId, 'foo', { from: exchangeOperator }),
      'YALLExchange: Order should be open'
    );

    // Can't close
    await assertRevert(
      exchange.closeOrder(orderId, 'foo', { from: exchangeOperator }),
      'YALLExchange: Order should be open'
    );

    // Can't void
    await assertRevert(
      exchange.voidOrder(orderId, { from: exchangeSuperOperator }),
      'YALLExchange: Order should be closed'
    );
  });

  describe('Limits', () => {
    beforeEach(async function () {
      await dist.addMembers([memberId3], [charlie], { from: distributorVerifier });
      await increaseTime(periodLength);
    });

    it('provide correct information on limits', async function () {
      await dist.claimFunds({ from: bob });
      await dist.claimFunds({ from: charlie });
      await yallToken.transfer(exchange.address, ether(0.02), { from: bob });

      await yallToken.transfer(charlie, ether(15), { from: bob });
      await yallToken.transfer(alice, ether(25), { from: bob });

      const firstPeriod = await dist.getCurrentPeriodId();

      await exchange.setDefaultMemberPeriodLimit(ether(30), { from: exchangeManager });
      await exchange.setTotalPeriodLimit(ether(70), { from: exchangeManager });

      // >>> Step 1

      // limit #1
      assert.equal(await exchange.calculateMaxYallToSell(memberId2), ether(75));

      // limit #2
      assert.equal(await exchange.checkExchangeFitsLimit2(memberId2, ether(30), firstPeriod), true);
      assert.equal(await exchange.checkExchangeFitsLimit2(memberId2, ether(31), firstPeriod), false);
      assert.equal(await exchange.checkExchangeFitsLimit2(memberId3, ether(30), firstPeriod), true);
      assert.equal(await exchange.checkExchangeFitsLimit2(memberId3, ether(31), firstPeriod), false);

      // limit #3
      assert.equal(await exchange.checkExchangeFitsLimit3(ether(70), firstPeriod), true);
      assert.equal(await exchange.checkExchangeFitsLimit3(ether(71), firstPeriod), false);
      assert.equal(await exchange.checkExchangeFitsLimit3(ether(70), firstPeriod), true);
      assert.equal(await exchange.checkExchangeFitsLimit3(ether(71), firstPeriod), false);

      // >>> Step 2
      await yallToken.approve(exchange.address, ether(10), { from: bob });
      await exchange.createOrder(ether(10), { from: bob });

      await yallToken.approve(exchange.address, ether(10), { from: bob });
      await exchange.createOrder(ether(10), { from: bob });

      // limit #1
      assert.equal(await exchange.calculateMaxYallToSell(memberId2), ether(55));
      assert.equal(await exchange.calculateMaxYallToSell(memberId3), ether(75));

      // limit #2
      assert.equal(await exchange.checkExchangeFitsLimit2(memberId2, ether(10), firstPeriod), true);
      assert.equal(await exchange.checkExchangeFitsLimit2(memberId2, ether(11), firstPeriod), false);
      assert.equal(await exchange.checkExchangeFitsLimit2(memberId3, ether(30), firstPeriod), true);
      assert.equal(await exchange.checkExchangeFitsLimit2(memberId3, ether(31), firstPeriod), false);

      // limit #3
      assert.equal(await exchange.checkExchangeFitsLimit3(ether(50), firstPeriod), true);
      assert.equal(await exchange.checkExchangeFitsLimit3(ether(51), firstPeriod), false);
      assert.equal(await exchange.checkExchangeFitsLimit3(ether(50), firstPeriod), true);
      assert.equal(await exchange.checkExchangeFitsLimit3(ether(51), firstPeriod), false);

      // >>> Step 3
      await exchange.closeOrder(1, 'foo', { from: exchangeOperator });
      await exchange.cancelOrder(2, 'bar', { from: exchangeOperator });

      // limit #1
      assert.equal(await exchange.calculateMaxYallToSell(memberId2), ether(65));
      assert.equal(await exchange.calculateMaxYallToSell(memberId3), ether(75));

      // limit #2
      assert.equal(await exchange.checkExchangeFitsLimit2(memberId2, ether(20), firstPeriod), true);
      assert.equal(await exchange.checkExchangeFitsLimit2(memberId2, ether(21), firstPeriod), false);
      assert.equal(await exchange.checkExchangeFitsLimit2(memberId3, ether(30), firstPeriod), true);
      assert.equal(await exchange.checkExchangeFitsLimit2(memberId3, ether(31), firstPeriod), false);

      // limit #3
      assert.equal(await exchange.checkExchangeFitsLimit3(ether(60), firstPeriod), true);
      assert.equal(await exchange.checkExchangeFitsLimit3(ether(61), firstPeriod), false);
      assert.equal(await exchange.checkExchangeFitsLimit3(ether(60), firstPeriod), true);
      assert.equal(await exchange.checkExchangeFitsLimit3(ether(61), firstPeriod), false);

      // >>> Step 4

      await increaseTime(periodLength);

      assert.equal(await exchange.calculateMaxYallToSell(memberId2), ether(65));
      assert.equal(await exchange.calculateMaxYallToSell(memberId3), ether(75));

      // limit #2
      assert.equal(await exchange.checkExchangeFitsLimit2(memberId2, ether(20), firstPeriod), true);
      assert.equal(await exchange.checkExchangeFitsLimit2(memberId2, ether(21), firstPeriod), false);
      assert.equal(await exchange.checkExchangeFitsLimit2(memberId3, ether(30), firstPeriod), true);
      assert.equal(await exchange.checkExchangeFitsLimit2(memberId3, ether(31), firstPeriod), false);

      // limit #3
      assert.equal(await exchange.checkExchangeFitsLimit3(ether(60), firstPeriod), true);
      assert.equal(await exchange.checkExchangeFitsLimit3(ether(61), firstPeriod), false);
      assert.equal(await exchange.checkExchangeFitsLimit3(ether(60), firstPeriod), true);
      assert.equal(await exchange.checkExchangeFitsLimit3(ether(61), firstPeriod), false);

      // >>> Step 5

      await dist.claimFunds({ from: bob });
      await dist.claimFunds({ from: charlie });

      const secondPeriod = await dist.getCurrentPeriodId();

      // limit #1
      assert.equal(await exchange.calculateMaxYallToSell(memberId2), ether(65 + 75));
      assert.equal(await exchange.calculateMaxYallToSell(memberId3), ether(75 + 75));

      // limit #2
      assert.equal(await exchange.checkExchangeFitsLimit2(memberId2, ether(20), firstPeriod), true);
      assert.equal(await exchange.checkExchangeFitsLimit2(memberId2, ether(21), firstPeriod), false);
      assert.equal(await exchange.checkExchangeFitsLimit2(memberId3, ether(30), firstPeriod), true);
      assert.equal(await exchange.checkExchangeFitsLimit2(memberId3, ether(31), firstPeriod), false);
      assert.equal(await exchange.checkExchangeFitsLimit2(memberId2, ether(30), secondPeriod), true);
      assert.equal(await exchange.checkExchangeFitsLimit2(memberId2, ether(31), secondPeriod), false);
      assert.equal(await exchange.checkExchangeFitsLimit2(memberId3, ether(30), secondPeriod), true);
      assert.equal(await exchange.checkExchangeFitsLimit2(memberId3, ether(31), secondPeriod), false);

      // limit #3
      assert.equal(await exchange.checkExchangeFitsLimit3(ether(60), firstPeriod), true);
      assert.equal(await exchange.checkExchangeFitsLimit3(ether(61), firstPeriod), false);
      assert.equal(await exchange.checkExchangeFitsLimit3(ether(60), firstPeriod), true);
      assert.equal(await exchange.checkExchangeFitsLimit3(ether(61), firstPeriod), false);
      assert.equal(await exchange.checkExchangeFitsLimit3(ether(70), secondPeriod), true);
      assert.equal(await exchange.checkExchangeFitsLimit3(ether(71), secondPeriod), false);
      assert.equal(await exchange.checkExchangeFitsLimit3(ether(70), secondPeriod), true);
      assert.equal(await exchange.checkExchangeFitsLimit3(ether(71), secondPeriod), false);
    });
  });
});
