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
const { approveFunction, assertRelayedCall, GSNRecipientSignatureErrorCodes } = require('./helpers')(web3);

CoinToken.numberFormat = 'String';
YALExchange.numberFormat = 'String';
YALDistributor.numberFormat = 'String';

const { ether, now, int, increaseTime, assertRevert, assertGsnReject, getEventArg, getResTimestamp, assertErc20BalanceChanged } = require('@galtproject/solidity-test-chest')(web3);

const keccak256 = web3.utils.soliditySha3;

const OrderStatus = {
    NULL: 0,
    OPEN: 1,
    CLOSED: 2,
    CANCELLED: 3,
    VOIDED: 4
};

describe('YALExchange Integration tests', () => {
    const [verifier, alice, bob, charlie, dan, eve, operator, superOperator, fundManager, feeManager, transferWlManager] = accounts;
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
            ether(19)
        );

        await yalToken.addRoleTo(dist.address, "minter");
        await yalToken.addRoleTo(dist.address, "burner");
        await yalToken.addRoleTo(feeManager, 'fee_manager');
        await yalToken.addRoleTo(transferWlManager, 'transfer_wl_manager');

        await yalToken.setDistributor(dist.address);
        await yalToken.setTransferFee(ether('0.02'), { from: feeManager });
        await yalToken.setGsnFee(ether('1.7'), { from: feeManager });

        await yalToken.setWhitelistAddress(dist.address, true, { from: transferWlManager });
        await yalToken.setWhitelistAddress(exchange.address, true, { from: transferWlManager });
        await yalToken.setWhitelistAddress(operator, true, { from: transferWlManager });
        await yalToken.setWhitelistAddress(superOperator, true, { from: transferWlManager });

        await dist.addMembersBeforeGenesis([memberId2], [bob], { from: verifier })
        await dist.addMembersBeforeGenesis([memberId1], [alice], { from: verifier })

        await dist.setGsnFee(ether('4.2'));

        await exchange.addRoleTo(fundManager, 'fund_manager');
        await exchange.addRoleTo(operator, 'operator');
        await exchange.addRoleTo(superOperator, 'super_operator');

        // this will affect on dist provider too
        yalToken.contract.currentProvider.wrappedProvider.relayClient.approveFunction = approveFunction;

        await deployRelayHub(web3);
        await fundRecipient(web3, { recipient: dist.address, amount: ether(1) });
    });

    it('should create/close/void order successfully', async function() {
        await increaseTime(11);

        await dist.claimFunds({ from: alice });

        assert.equal(await yalToken.balanceOf(alice), ether( 112.5));

        await exchange.setDefaultExchangeRate(ether(350), { from: fundManager });

        // Create an order
        await yalToken.approve(exchange.address, ether(12), { from: alice });
        let res = await exchange.createOrder(ether(12), { from: alice });
        const orderId = getEventArg(res, 'CreateOrder', 'orderId');
        
        assert.equal(orderId, 1);

        res = await exchange.orders(orderId);

        assert.equal(res.status, OrderStatus.OPEN);
        assert.equal(res.memberId, memberId1);

        // Close an order
        await assertRevert(exchange.closeOrder(orderId, 'foo', { from: superOperator }), 'YALExchange: Only operator role allowed');
        await assertRevert(exchange.closeOrder(orderId, 'foo', { from: alice }), 'YALExchange: Only operator role allowed');
        await exchange.closeOrder(orderId, 'foo', { from: operator });

        res = await exchange.orders(orderId);
        assert.equal(res.status, OrderStatus.CLOSED);

        // Can't close again
        await assertRevert(exchange.closeOrder(orderId, 'foo', { from: operator }), 'YALExchange: Order should be open');

        // Can't cancel
        await assertRevert(exchange.cancelOrder(orderId, 'foo', { from: operator }), 'YALExchange: Order should be open');

        // But can void
        await assertRevert(exchange.voidOrder(orderId, { from: operator }), 'YALExchange: Only super operator role allowed');
        await exchange.voidOrder(orderId, { from: superOperator });

        res = await exchange.orders(orderId);
        assert.equal(res.status, OrderStatus.VOIDED);
    });

    it('should create/cancel order successfully', async function() {
        await increaseTime(11);

        await dist.claimFunds({ from: alice });

        assert.equal(await yalToken.balanceOf(alice), ether( 112.5));

        await exchange.setDefaultExchangeRate(ether(350), { from: fundManager });

        // Create an order
        await yalToken.approve(exchange.address, ether(12), { from: alice });
        let res = await exchange.createOrder(ether(12), { from: alice });
        const orderId = getEventArg(res, 'CreateOrder', 'orderId');

        assert.equal(orderId, 1);

        res = await exchange.orders(orderId);
        assert.equal(res.status, OrderStatus.OPEN);

        // Close an order
        await assertRevert(exchange.closeOrder(orderId, 'foo', { from: superOperator }), 'YALExchange: Only operator role allowed');
        await assertRevert(exchange.closeOrder(orderId, 'foo', { from: alice }), 'YALExchange: Only operator role allowed');
        await exchange.cancelOrder(orderId, 'foo', { from: operator });

        res = await exchange.orders(orderId);
        assert.equal(res.status, OrderStatus.CANCELLED);

        // Can't cancel again
        await assertRevert(exchange.cancelOrder(orderId, 'foo', { from: operator }), 'YALExchange: Order should be open');

        // Can't close
        await assertRevert(exchange.closeOrder(orderId, 'foo', { from: operator }), 'YALExchange: Order should be open');

        // Can't void
        await assertRevert(exchange.voidOrder(orderId, { from: superOperator }), 'YALExchange: Order should be closed');
    });
});
