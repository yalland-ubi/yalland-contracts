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

const YALLToken = contract.fromArtifact('CoinTokenL');
const YALLDistributor = contract.fromArtifact('YALLDistributorL');
const YALLExchange = contract.fromArtifact('YALLExchange');
const Proxy = contract.fromArtifact('OwnedUpgradeabilityProxy');

YALLToken.numberFormat = 'String';
YALLExchange.numberFormat = 'String';
YALLDistributor.numberFormat = 'String';

const { ether, now, increaseTime, assertRevert, getEventArg } = require('@galtproject/solidity-test-chest')(web3);

const keccak256 = web3.utils.soliditySha3;

const OrderStatus = {
    NULL: 0,
    OPEN: 1,
    CLOSED: 2,
    CANCELLED: 3,
    VOIDED: 4
};

describe.skip('YALLExchangeLegacy Integration tests', () => {
    const [verifier, alice, bob, charlie, dan, minter, operator, superOperator, fundManager, feeManager, transferWlManager] = accounts;
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
        genesisTimestamp = parseInt(await now(), 10) + startAfter;
        yallToken = await YALLToken.new("Coin token", "COIN", 18);

        const distProxy = await Proxy.new();
        const exchangeProxy = await Proxy.new();

        const distImplementation = await YALLDistributor.new();
        const exchangeImplementation = await YALLExchange.new();

        const distInitTx = distImplementation.contract.methods.initialize(
            periodVolume,
            verifier,
            verifierRewardShare,

            yallToken.address,
            periodLength,
            genesisTimestamp
        ).encodeABI();

        const exchangeInitTx = exchangeImplementation.contract.methods.initialize(
            defaultSender,
            distProxy.address,
            yallToken.address,
            // defaultExchangeRate numerator
            ether(42)
        ).encodeABI();

        await distProxy.upgradeToAndCall(distImplementation.address, distInitTx);
        await exchangeProxy.upgradeToAndCall(exchangeImplementation.address, exchangeInitTx);

        dist = await YALLDistributor.at(distProxy.address);
        exchange = await YALLExchange.at(exchangeProxy.address);

        await yallToken.addRoleTo(minter, "minter");
        await yallToken.addRoleTo(dist.address, "minter");
        await yallToken.addRoleTo(dist.address, "burner");
        await yallToken.addRoleTo(feeManager, 'fee_manager');
        await yallToken.addRoleTo(transferWlManager, 'transfer_wl_manager');

        // 0.02 szabo
        await yallToken.setTransferFee('20000000000', { from: feeManager });

        await dist.addMembersBeforeGenesis([memberId1], [alice], { from: verifier })
        await dist.addMembersBeforeGenesis([memberId2], [bob], { from: verifier })

        await exchange.addRoleTo(fundManager, 'fund_manager');
        await exchange.addRoleTo(operator, 'operator');
        await exchange.addRoleTo(superOperator, 'super_operator');

        await exchange.setDefaultMemberPeriodLimit(ether(30), { from: fundManager });
        await exchange.setTotalPeriodLimit(ether(70), { from: fundManager });

        await yallToken.mint(dan, ether(11), { from: minter });
        assert.equal(await yallToken.balanceOf(dan), ether(11));
        await yallToken.transfer(exchange.address, ether(10), { from: dan });

        await increaseTime(12);
    });

    it('should create/close/void order successfully', async function() {
        await dist.claimFunds({ from: alice });

        assert.equal(await yallToken.balanceOf(alice), ether( 112.5));

        await exchange.setDefaultExchangeRate(ether(350), { from: fundManager });

        // Create an order
        await yallToken.approve(exchange.address, ether(12), { from: alice });
        let res = await exchange.createOrder(ether(12), { from: alice });
        const orderId = getEventArg(res, 'CreateOrder', 'orderId');
        
        assert.equal(orderId, 1);

        res = await exchange.orders(orderId);

        assert.equal(res.status, OrderStatus.OPEN);
        assert.equal(res.memberId, memberId1);

        // Close an order
        await assertRevert(exchange.closeOrder(orderId, 'foo', { from: superOperator }), 'YALLExchange: Only operator role allowed');
        await assertRevert(exchange.closeOrder(orderId, 'foo', { from: alice }), 'YALLExchange: Only operator role allowed');
        await exchange.closeOrder(orderId, 'foo', { from: operator });

        res = await exchange.orders(orderId);
        assert.equal(res.status, OrderStatus.CLOSED);

        // Can't close again
        await assertRevert(exchange.closeOrder(orderId, 'foo', { from: operator }), 'YALLExchange: Order should be open');

        // Can't cancel
        await assertRevert(exchange.cancelOrder(orderId, 'foo', { from: operator }), 'YALLExchange: Order should be open');

        // But can void
        await assertRevert(exchange.voidOrder(orderId, { from: operator }), 'YALLExchange: Only super operator role allowed');
        await yallToken.mint(superOperator, ether(12), { from: minter });
        await yallToken.approve(exchange.address, ether(12), { from: superOperator });
        await exchange.voidOrder(orderId, { from: superOperator });

        res = await exchange.orders(orderId);
        assert.equal(res.status, OrderStatus.VOIDED);
    });

    it('should create/cancel order successfully', async function() {
        await dist.claimFunds({ from: alice });

        assert.equal(await yallToken.balanceOf(alice), ether( 112.5));

        await exchange.setDefaultExchangeRate(ether(350), { from: fundManager });

        // Create an order
        await yallToken.approve(exchange.address, ether(12), { from: alice });
        let res = await exchange.createOrder(ether(12), { from: alice });
        const orderId = getEventArg(res, 'CreateOrder', 'orderId');

        assert.equal(orderId, 1);

        res = await exchange.orders(orderId);
        assert.equal(res.status, OrderStatus.OPEN);

        // Close an order
        await assertRevert(exchange.closeOrder(orderId, 'foo', { from: superOperator }), 'YALLExchange: Only operator role allowed');
        await assertRevert(exchange.closeOrder(orderId, 'foo', { from: alice }), 'YALLExchange: Only operator role allowed');
        await exchange.cancelOrder(orderId, 'foo', { from: operator });

        res = await exchange.orders(orderId);
        assert.equal(res.status, OrderStatus.CANCELLED);

        // Can't cancel again
        await assertRevert(exchange.cancelOrder(orderId, 'foo', { from: operator }), 'YALLExchange: Order should be open');

        // Can't close
        await assertRevert(exchange.closeOrder(orderId, 'foo', { from: operator }), 'YALLExchange: Order should be open');

        // Can't void
        await assertRevert(exchange.voidOrder(orderId, { from: superOperator }), 'YALLExchange: Order should be closed');
    });

    describe('Limits', () => {
        beforeEach(async function() {
            await dist.addMembers([memberId3], [charlie], { from: verifier });
            await increaseTime(periodLength);
        });

        it('provide correct information on limits', async function() {
            await dist.claimFunds({ from: bob });
            await dist.claimFunds({ from: charlie });
            await yallToken.transfer(exchange.address, ether(0.02), { from: bob });

            await yallToken.transfer(charlie, ether(15), { from: bob });
            await yallToken.transfer(alice, ether(25), { from: bob });

            const firstPeriod = await dist.getCurrentPeriodId();

            await exchange.setDefaultMemberPeriodLimit(ether(30), { from: fundManager });
            await exchange.setTotalPeriodLimit(ether(70), { from: fundManager });

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
            await exchange.closeOrder(1, 'foo', { from: operator });
            await exchange.cancelOrder(2, 'bar', { from: operator });

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