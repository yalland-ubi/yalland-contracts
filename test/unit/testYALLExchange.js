/*
 * Copyright ©️ 2020 Galt•Project Society Construction and Terraforming Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka)
 *
 * Copyright ©️ 2020 Galt•Core Blockchain Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka) by
 * [Basic Agreement](ipfs/QmaCiXUmSrP16Gz8Jdzq6AJESY1EAANmmwha15uR3c1bsS)).
 */

const { accounts, defaultSender } = require('@openzeppelin/test-environment');
// eslint-disable-next-line import/order
const { contract } = require('../twrapper');
const { assert } = require('chai');
const BigNumber = require('bignumber.js');
const { deployRelayHub, fundRecipient } = require('@openzeppelin/gsn-helpers');
const {
  ether,
  increaseTime,
  assertRevert,
  assertGsnReject,
  getEventArg,
  getResTimestamp,
  assertErc20BalanceChanged,
} = require('@galtproject/solidity-test-chest')(web3);

const { assertRelayedCall, GSNRecipientSignatureErrorCodes } = require('../helpers')(web3);
const { buildCoinDistAndExchange } = require('../builders');

const MockMeter = contract.fromArtifact('MockMeter');

const keccak256 = web3.utils.soliditySha3;

const OrderStatus = {
  NULL: 0,
  OPEN: 1,
  CLOSED: 2,
  CANCELLED: 3,
  VOIDED: 4,
};

describe('YALLExchange Unit tests', () => {
  const [
    distributorVerifier,
    alice,
    bob,
    charlie,
    dan,
    feeCollector,
    gsnFeeCollector,
    exchangeSuperOperator,
    pauser,
    yallMinter,
    yallBurner,
    exchangeOperator,
    exchangeManager,
    feeManager,
    yallTokenManager,
  ] = accounts;
  const owner = defaultSender;

  // 7 days
  const periodLength = 7 * 24 * 60 * 60;
  const periodVolume = ether(250);
  const baseAliceBalance = 10000000;
  const memberId1 = keccak256('bob');
  const memberId2 = keccak256('charlie');
  const memberId3 = keccak256('dan');
  let yallToken;
  let exchange;
  let dist;
  let registry;

  beforeEach(async function () {
    ({ registry, yallToken, dist, exchange } = await buildCoinDistAndExchange(defaultSender, {
      periodVolume,
      feeManager,
      feeCollector,
      gsnFeeCollector,
      pauser,
      yallMinter,
      yallBurner,
      yallTokenManager,
      distributorVerifier,
      exchangeManager,
      exchangeOperator,
      exchangeSuperOperator,
      disableEmission: true,
      disableCommission: true,
    }));

    await yallToken.mint(alice, ether(baseAliceBalance), { from: yallMinter });
    await yallToken.setTransferFee(ether('0.02'), { from: feeManager });
    await yallToken.setGsnFee(ether('1.7'), { from: feeManager });

    await yallToken.setCanTransferWhitelistAddress(dist.address, true, { from: yallTokenManager });
    await yallToken.setCanTransferWhitelistAddress(exchange.address, true, { from: yallTokenManager });
    await yallToken.setCanTransferWhitelistAddress(exchangeOperator, true, { from: yallTokenManager });
    await yallToken.setCanTransferWhitelistAddress(exchangeSuperOperator, true, { from: yallTokenManager });

    await dist.setGsnFee(ether('4.2'), { from: feeManager });

    await exchange.setDefaultMemberPeriodLimit(ether(30), { from: exchangeManager });
    await exchange.setTotalPeriodLimit(ether(70), { from: exchangeManager });
    await exchange.setGsnFee(ether('3'), { from: feeManager });

    await deployRelayHub(web3);
    await fundRecipient(web3, { recipient: exchange.address, amount: ether(1) });
  });

  describe('ExchangeManager Interface', () => {
    describe('#setDefaultExchangeRate()', () => {
      it('should allow a exchange manager setting the default exchange rate', async function () {
        await exchange.setDefaultExchangeRate(ether(123), { from: exchangeManager });
        assert.equal(await exchange.defaultExchangeRate(), ether(123));
      });

      it('should deny 0 exchange rate', async function () {
        await assertRevert(exchange.setDefaultExchangeRate(0, { from: exchangeManager }), "Default rate can't be 0");
      });

      it('should deny a non-exchange manager setting the default exchange rate', async function () {
        await assertRevert(
          exchange.setDefaultExchangeRate(ether(123), { from: owner }),
          'YALLExchange: Only EXCHANGE_MANAGER allowed'
        );
      });
    });

    describe('#setCustomExchangeRate()', () => {
      it('should allow a exchange manager setting the default exchange rate', async function () {
        await exchange.setCustomExchangeRate(memberId2, ether(42), { from: exchangeManager });
        assert.equal(await exchange.getCustomExchangeRate(memberId2), ether(42));
      });

      it('should deny a non-exchange manager setting a custom exchange rate', async function () {
        await assertRevert(
          exchange.setCustomExchangeRate(memberId2, ether(123), { from: owner }),
          'YALLExchange: Only EXCHANGE_MANAGER allowed'
        );
      });
    });

    describe('#setTotalPeriodLimit()', () => {
      it('should allow a exchange manager setting the default exchange rate', async function () {
        await exchange.setTotalPeriodLimit(ether(123), { from: exchangeManager });
        assert.equal(await exchange.totalPeriodLimit(), ether(123));
      });

      it('should deny a non-exchange manager setting the total period limit', async function () {
        await assertRevert(
          exchange.setTotalPeriodLimit(ether(123), { from: owner }),
          'YALLExchange: Only EXCHANGE_MANAGER allowed'
        );
      });
    });

    describe('#setDefaultMemberPeriodLimit()', () => {
      it('should allow a exchange manager setting the default member limit', async function () {
        await exchange.setDefaultMemberPeriodLimit(ether(123), { from: exchangeManager });
        assert.equal(await exchange.defaultMemberPeriodLimit(), ether(123));
      });

      it('should deny a non-exchange manager setting the default member limit', async function () {
        await assertRevert(
          exchange.setDefaultMemberPeriodLimit(ether(123), { from: owner }),
          'YALLExchange: Only EXCHANGE_MANAGER allowed'
        );
      });
    });

    describe('#setCustomPeriodLimit()', () => {
      it('should allow a exchange manager setting the custom period limit', async function () {
        await exchange.setCustomPeriodLimit(memberId2, ether(42), { from: exchangeManager });
        assert.equal(await exchange.getCustomPeriodLimit(memberId2), ether(42));
      });

      it('should deny a non-exchange manager setting the custom period limit', async function () {
        await assertRevert(
          exchange.setCustomPeriodLimit(memberId2, ether(123), { from: owner }),
          'YALLExchange: Only EXCHANGE_MANAGER allowed'
        );
      });
    });
  });

  describe('Pauser Interface', () => {
    describe('#pause()/#unpause()', () => {
      it('should allow a pauser pausing/unpausing contract', async function () {
        assert.equal(await exchange.paused(), false);
        await exchange.pause({ from: pauser });
        assert.equal(await exchange.paused(), true);
        await exchange.unpause({ from: pauser });
        assert.equal(await exchange.paused(), false);
      });

      it('should deny non-pauser pausing/unpausing contract', async function () {
        await assertRevert(exchange.pause({ from: distributorVerifier }), 'YALLHelpers: Only PAUSER allowed');
        await assertRevert(exchange.unpause({ from: distributorVerifier }), 'YALLHelpers: Only PAUSER allowed');
      });
    });
  });

  describe('Member Interface', () => {
    beforeEach(async function () {
      await dist.addMembersBeforeGenesis([memberId1, memberId2, memberId3], [bob, charlie, dan], {
        from: distributorVerifier,
      });
      await increaseTime(11);
    });

    describe('#createOrder()', () => {
      it('should deny creating order with 0 amount of YALLs', async function () {
        await assertRevert(exchange.createOrder(0, { from: bob }), "YALLExchange: YALL amount can't be 0");
      });

      it('should deny creating order for non-active member', async function () {
        await dist.disableMembers([bob], { from: distributorVerifier });
        await assertRevert(exchange.createOrder(1, { from: bob }), "YALLExchange: Member isn't active");
      });

      it('should deny creating an order if a contract is paused', async function () {
        await exchange.pause({ from: pauser });
        await assertRevert(exchange.createOrder(1, { from: bob }), 'Pausable: paused');
      });

      it('should deny creating an order if Limit #1 value isnt satisfied', async function () {
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

        beforeEach(async function () {
          await dist.claimFunds({ from: bob });
          await yallToken.approve(exchange.address, ether(12), { from: bob });
          const res = await exchange.createOrder(ether(12), { from: bob });

          orderId = getEventArg(res, 'CreateOrder', 'orderId');
          createdAt = await getResTimestamp(res);

          await yallToken.approve(exchange.address, ether(12), { from: bob });
        });

        it('should transfer corresponding amount to the contract balance', async function () {
          await yallToken.approve(exchange.address, 123, { from: bob });

          const exchangeBalanceBefore = await yallToken.balanceOf(exchange.address);
          await exchange.createOrder(123, { from: bob });
          const exchangeBalanceAfter = await yallToken.balanceOf(exchange.address);

          assertErc20BalanceChanged(exchangeBalanceBefore, exchangeBalanceAfter, '123');
        });

        it('should allow creating an order using GSN', async function () {
          // 3 - is a GSN fee
          await yallToken.approve(exchange.address, ether(13 + 3), { from: bob });

          const newGsnFeeCollector = (await MockMeter.new()).address;
          await yallToken.setCanTransferWhitelistAddress(newGsnFeeCollector, true, { from: yallTokenManager });
          await registry.setContract(await registry.YALL_GSN_FEE_COLLECTOR_KEY(), newGsnFeeCollector);
          assert.equal(await yallToken.balanceOf(newGsnFeeCollector), 0);

          const gsnFeeCollectorBalanceBefore = await yallToken.balanceOf(newGsnFeeCollector);
          const exchangeBalanceBefore = await yallToken.balanceOf(exchange.address);
          const bobsBalanceBefore = await yallToken.balanceOf(bob);

          const res = await exchange.createOrder(ether(13), { from: bob, useGSN: true });
          assertRelayedCall(res);
          // console.log('>>>', getEventArg(res, 'DebugPreRelayedCall', 'gasUsed'));

          const gsnFeeCollectorBalanceAfter = await yallToken.balanceOf(newGsnFeeCollector);
          const exchangeBalanceAfter = await yallToken.balanceOf(exchange.address);
          const bobsBalanceAfter = await yallToken.balanceOf(bob);

          const thirteen = new BigNumber(ether(13));
          const three = new BigNumber(ether(3));

          assertErc20BalanceChanged(gsnFeeCollectorBalanceBefore, gsnFeeCollectorBalanceAfter, three.toString());
          assertErc20BalanceChanged(exchangeBalanceBefore, exchangeBalanceAfter, thirteen.toString());
          assertErc20BalanceChanged(bobsBalanceBefore, bobsBalanceAfter, ether(-16));
        });

        it('should increment order id by 1 on each call', async function () {
          let res = await exchange.createOrder(1, { from: bob });
          assert.equal(getEventArg(res, 'CreateOrder', 'orderId'), 2);

          res = await exchange.createOrder(1, { from: bob });
          assert.equal(getEventArg(res, 'CreateOrder', 'orderId'), 3);

          res = await exchange.createOrder(1, { from: bob });
          assert.equal(getEventArg(res, 'CreateOrder', 'orderId'), 4);
        });

        it('should fill required fields after creation', async function () {
          const res = await exchange.orders(orderId);
          assert.equal(res.status, OrderStatus.OPEN);
          assert.equal(res.memberId, memberId1);
          assert.equal(res.yallAmount, ether(12));
          assert.equal(res.buyAmount, ether('5.04'));
          assert.equal(res.createdAt, createdAt);
          assert.equal(res.paymentDetails, '');
        });

        it('should update accumulators', async function () {
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
          beforeEach(async function () {
            assert.equal(await yallToken.balanceOf(bob), ether(63));
            assert.equal(await exchange.gsnFee(), ether('3'));
          });

          it('should deny creating an order without sufficient pre-approved funds using GSN', async function () {
            await yallToken.approve(exchange.address, 0, { from: bob });
            assert.equal(await yallToken.allowance(bob, exchange.address), 0);

            await assertGsnReject(
              exchange.createOrder(ether(1), { from: bob, gasLimit: 9000000, useGSN: true }),
              GSNRecipientSignatureErrorCodes.INSUFFICIENT_BALANCE
            );

            assert.equal(await yallToken.balanceOf(bob), ether(63));
          });

          it('should deny creating a new order without sufficient funds using GSN', async function () {
            await yallToken.approve(dist.address, ether(12), { from: bob });
            await yallToken.burn(bob, ether(62), { from: yallBurner });
            assert.equal(await yallToken.balanceOf(bob), ether(1));
            assert.equal(await yallToken.allowance(bob, dist.address), ether(12));

            await assertGsnReject(
              exchange.createOrder(ether(1), { from: bob, gasLimit: 9000000, useGSN: true }),
              GSNRecipientSignatureErrorCodes.INSUFFICIENT_BALANCE
            );

            assert.equal(await yallToken.balanceOf(bob), ether(1));
          });
        });
      });
    });
  });

  describe('Operator Interface', () => {
    let orderId;

    beforeEach(async function () {
      await dist.addMembersBeforeGenesis([memberId1, memberId2, memberId3], [alice, bob, charlie], {
        from: distributorVerifier,
      });
      await increaseTime(12);

      await dist.claimFunds({ from: bob });

      await yallToken.approve(exchange.address, ether(12), { from: bob });
      const res = await exchange.createOrder(ether(12), { from: bob });

      orderId = getEventArg(res, 'CreateOrder', 'orderId');

      // for erc20 fees
      await yallToken.transfer(exchange.address, ether(1), { from: bob });
    });

    describe('#closeOrder()', () => {
      it('should change corresponding oder information', async function () {
        await exchange.closeOrder(orderId, 'blah', { from: exchangeOperator });
        const res = await exchange.orders(orderId);
        assert.equal(res.status, OrderStatus.CLOSED);
        assert.equal(res.paymentDetails, 'blah');
      });

      it('should transfer YALLs to an exchangeOperator', async function () {
        const exchangeOperatorBalanceBefore = await yallToken.balanceOf(exchangeOperator);
        await exchange.closeOrder(orderId, 'blah', { from: exchangeOperator });
        const exchangeOperatorBalanceAfter = await yallToken.balanceOf(exchangeOperator);

        assertErc20BalanceChanged(exchangeOperatorBalanceBefore, exchangeOperatorBalanceAfter, ether(12));
      });

      it('should deny closing second time', async function () {
        await exchange.closeOrder(orderId, 'blah', { from: exchangeOperator });
        await assertRevert(
          exchange.closeOrder(orderId, 'blah', { from: exchangeOperator }),
          'YALLExchange: Order should be open'
        );
      });

      it('should deny non-exchangeOperator closing an order', async function () {
        await assertRevert(
          exchange.closeOrder(orderId, 'blah', { from: exchangeSuperOperator }),
          'YALLExchange: Only EXCHANGE_OPERATOR allowed'
        );
      });
    });

    describe('#cancelOrder()', () => {
      it('should change corresponding order information', async function () {
        let res = await exchange.cancelOrder(orderId, 'blah', { from: exchangeOperator });
        assert.equal(getEventArg(res, 'CancelOrder', 'reason'), 'blah');
        res = await exchange.orders(orderId);
        assert.equal(res.status, OrderStatus.CANCELLED);
        assert.equal(res.paymentDetails, '');
      });

      it('should transfer YALLs back to a member', async function () {
        const bobsBalanceBefore = await yallToken.balanceOf(bob);
        await exchange.cancelOrder(orderId, 'blah', { from: exchangeOperator });
        const bobsBalanceAfter = await yallToken.balanceOf(bob);

        assertErc20BalanceChanged(bobsBalanceBefore, bobsBalanceAfter, ether(12));
      });

      it('should decrement accumulators', async function () {
        const currentPeriod = await dist.getCurrentPeriodId();
        const assertChanged = assertErc20BalanceChanged;

        const totalExchangedYallBefore = await exchange.totalExchangedYall();
        const yallExchangedByPeriodBefore = await exchange.yallExchangedByPeriod(currentPeriod);

        const bobsYallExchangedByPeriodBefore = (await exchange.members(memberId2)).totalExchanged;
        const bobsTotalExchangedYallBefore = await exchange.getMemberYallExchangedInCurrentPeriod(memberId2);

        await exchange.cancelOrder(orderId, 'blah', { from: exchangeOperator });

        const totalExchangedYallAfter = await exchange.totalExchangedYall();
        const yallExchangedByPeriodAfter = await exchange.yallExchangedByPeriod(currentPeriod);

        const bobsYalExchangedByPeriodAfter = (await exchange.members(memberId2)).totalExchanged;
        const bobsTotalExchangedYallAfter = await exchange.getMemberYallExchangedInCurrentPeriod(memberId2);

        assertChanged(totalExchangedYallBefore, totalExchangedYallAfter, ether(-12));
        assertChanged(yallExchangedByPeriodBefore, yallExchangedByPeriodAfter, ether(-12));

        assertChanged(bobsYallExchangedByPeriodBefore, bobsYalExchangedByPeriodAfter, ether(-12));
        assertChanged(bobsTotalExchangedYallBefore, bobsTotalExchangedYallAfter, ether(-12));
      });

      it('should deny cancelling second time', async function () {
        await exchange.cancelOrder(orderId, 'blah', { from: exchangeOperator });
        await assertRevert(
          exchange.cancelOrder(orderId, 'blah', { from: exchangeOperator }),
          'YALLExchange: Order should be open'
        );
      });

      it('should deny non-exchangeOperator cancelling an order', async function () {
        await assertRevert(
          exchange.cancelOrder(orderId, 'blah', { from: exchangeSuperOperator }),
          'YALLExchange: Only EXCHANGE_OPERATOR allowed'
        );
      });
    });
  });

  describe('Super Operator Interface', () => {
    let orderId;

    beforeEach(async function () {
      await dist.addMembersBeforeGenesis([memberId1, memberId2, memberId3], [alice, bob, charlie], {
        from: distributorVerifier,
      });
      await increaseTime(12);

      await dist.claimFunds({ from: bob });

      await yallToken.approve(exchange.address, ether(12), { from: bob });
      const res = await exchange.createOrder(ether(12), { from: bob });

      orderId = getEventArg(res, 'CreateOrder', 'orderId');

      // for erc20 fees
      await yallToken.transfer(exchange.address, ether(1), { from: bob });
      await yallToken.transfer(exchangeSuperOperator, ether(1), { from: bob });
    });

    describe('#voidOrder()', () => {
      describe('for closed orders', () => {
        beforeEach(async function () {
          await exchange.closeOrder(orderId, 'blah', { from: exchangeOperator });

          // to refund the bobs order
          await dist.claimFunds({ from: alice });
          await yallToken.transfer(exchangeSuperOperator, ether(13), { from: alice });
        });

        it('should allow a super_exchangeOperator role voiding an order', async function () {
          await yallToken.approve(exchange.address, ether(12), { from: exchangeSuperOperator });
          await exchange.voidOrder(orderId, { from: exchangeSuperOperator });

          const res = await exchange.orders(orderId);
          assert.equal(res.status, OrderStatus.VOIDED);
        });

        it('should transfer a refund from super exchangeOperator to an order creator', async function () {
          const exchangeOperatorBalanceBefore = await yallToken.balanceOf(exchangeSuperOperator);
          const bobsBalanceBefore = await yallToken.balanceOf(bob);

          await yallToken.approve(exchange.address, ether(12), { from: exchangeSuperOperator });
          await exchange.voidOrder(orderId, { from: exchangeSuperOperator });

          const exchangeOperatorBalanceAfter = await yallToken.balanceOf(exchangeSuperOperator);
          const bobsBalanceAfter = await yallToken.balanceOf(bob);

          assertErc20BalanceChanged(exchangeOperatorBalanceBefore, exchangeOperatorBalanceAfter, ether(-12));
          assertErc20BalanceChanged(bobsBalanceBefore, bobsBalanceAfter, ether(12));
        });

        it('should transfer a refund from super exchangeOperator to a changed member address', async function () {
          await dist.changeMyAddress(dan, { from: bob });

          const exchangeOperatorBalanceBefore = await yallToken.balanceOf(exchangeSuperOperator);
          const bobsBalanceBefore = await yallToken.balanceOf(bob);
          const dansBalanceBefore = await yallToken.balanceOf(dan);

          await yallToken.approve(exchange.address, ether(12), { from: exchangeSuperOperator });
          await exchange.voidOrder(orderId, { from: exchangeSuperOperator });

          const exchangeOperatorBalanceAfter = await yallToken.balanceOf(exchangeSuperOperator);
          const bobsBalanceAfter = await yallToken.balanceOf(bob);
          const dansBalanceAfter = await yallToken.balanceOf(dan);

          assertErc20BalanceChanged(exchangeOperatorBalanceBefore, exchangeOperatorBalanceAfter, ether(-12));
          assertErc20BalanceChanged(bobsBalanceBefore, bobsBalanceAfter, ether(0));
          assertErc20BalanceChanged(dansBalanceBefore, dansBalanceAfter, ether(12));
        });

        it('should deny non-exchangeSuperOperator voiding an order', async function () {
          await assertRevert(
            exchange.voidOrder(orderId, { from: exchangeOperator }),
            'YALLExchange: Only EXCHANGE_SUPER_OPERATOR allowed'
          );
        });
      });

      it('should deny voiding an order if its not closed', async function () {
        await exchange.cancelOrder(orderId, 'blah', { from: exchangeOperator });
        await assertRevert(
          exchange.voidOrder(orderId, { from: exchangeSuperOperator }),
          'YALLExchange: Order should be closed'
        );
      });
    });
  });

  describe('Limits', () => {
    beforeEach(async function () {
      await dist.addMembersBeforeGenesis([memberId1, memberId2, memberId3], [alice, bob, charlie], {
        from: distributorVerifier,
      });
      await increaseTime(12);
    });

    describe('Limit #1', () => {
      it('should be 0 if there are no funds claimed yet', async function () {
        assert.equal(await exchange.calculateMaxYallToSell(memberId2), 0);
      });

      it('should equal the amount of claimed funds if not exchanged yet', async function () {
        await dist.claimFunds({ from: bob });
        assert.equal(await exchange.calculateMaxYallToSell(memberId2), ether(75));

        await increaseTime(periodLength);
        await dist.claimFunds({ from: bob });
        assert.equal(await exchange.calculateMaxYallToSell(memberId2), ether(2 * 75));

        await increaseTime(periodLength);
        await dist.claimFunds({ from: bob });
        assert.equal(await exchange.calculateMaxYallToSell(memberId2), ether(3 * 75));
      });

      it('should reduce amount for opened orders', async function () {
        await dist.claimFunds({ from: bob });

        assert.equal(await exchange.calculateMaxYallToSell(memberId2), ether(75));

        await yallToken.approve(exchange.address, ether(10), { from: bob });
        await exchange.createOrder(ether(10), { from: bob });

        assert.equal(await exchange.calculateMaxYallToSell(memberId2), ether(65));
      });

      it('should reduce amount for canceled or closed orders', async function () {
        await dist.claimFunds({ from: bob });
        await yallToken.transfer(exchange.address, ether(0.02), { from: bob });

        assert.equal(await exchange.calculateMaxYallToSell(memberId2), ether(75));

        await yallToken.approve(exchange.address, ether(10), { from: bob });
        await exchange.createOrder(ether(10), { from: bob });

        await yallToken.approve(exchange.address, ether(10), { from: bob });
        await exchange.createOrder(ether(10), { from: bob });

        assert.equal(await exchange.calculateMaxYallToSell(memberId2), ether(55));

        await exchange.closeOrder(1, 'foo', { from: exchangeOperator });
        assert.equal(await exchange.calculateMaxYallToSell(memberId2), ether(55));

        await exchange.cancelOrder(2, 'bar', { from: exchangeOperator });
        assert.equal(await exchange.calculateMaxYallToSell(memberId2), ether(65));
      });
    });

    describe('Limit #2', () => {
      let currentPeriodId;

      beforeEach(async function () {
        currentPeriodId = await dist.getCurrentPeriodId();
        await exchange.setDefaultMemberPeriodLimit(ether(40), { from: exchangeManager });
        await exchange.setCustomPeriodLimit(memberId1, ether(30), { from: exchangeManager });
      });

      it('should use default member limit if no personal set', async function () {
        assert.equal(await exchange.checkExchangeFitsLimit2(memberId2, ether(30), currentPeriodId), true);
        assert.equal(await exchange.checkExchangeFitsLimit2(memberId2, ether(40), currentPeriodId), true);
        assert.equal(await exchange.checkExchangeFitsLimit2(memberId2, ether(41), currentPeriodId), false);
      });

      it('should use a personal member limit if it is not 0', async function () {
        assert.equal(await exchange.checkExchangeFitsLimit2(memberId1, ether(30), currentPeriodId), true);
        assert.equal(await exchange.checkExchangeFitsLimit2(memberId1, ether(31), currentPeriodId), false);
        assert.equal(await exchange.checkExchangeFitsLimit2(memberId1, ether(41), currentPeriodId), false);
      });

      it('should not apply any limits if both personal and custom are 0', async function () {
        await exchange.setDefaultMemberPeriodLimit(ether(0), { from: exchangeManager });
        assert.equal(await exchange.checkExchangeFitsLimit2(memberId2, ether(30), currentPeriodId), true);
        assert.equal(await exchange.checkExchangeFitsLimit2(memberId2, ether(10000000), currentPeriodId), true);
      });
    });

    describe('Limit #3', () => {
      let currentPeriodId;

      beforeEach(async function () {
        currentPeriodId = await dist.getCurrentPeriodId();
        await exchange.setTotalPeriodLimit(ether(100), { from: exchangeManager });
      });

      it('should use non-zero period limit', async function () {
        assert.equal(await exchange.checkExchangeFitsLimit3(ether(100), currentPeriodId), true);
        assert.equal(await exchange.checkExchangeFitsLimit3(ether(101), currentPeriodId), false);
      });

      it('should ignore zero period limit', async function () {
        await exchange.setTotalPeriodLimit(ether(0), { from: exchangeManager });
        assert.equal(await exchange.checkExchangeFitsLimit3(ether(100), currentPeriodId), true);
        assert.equal(await exchange.checkExchangeFitsLimit3(ether(100000), currentPeriodId), true);
      });
    });
  });
});
