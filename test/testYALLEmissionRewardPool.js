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
const { contract } = require('./twrapper');
const { assert } = require('chai');
const {
  ether,
  now,
  increaseTime,
  assertRevert,
  assertErc20BalanceChanged,
} = require('@galtproject/solidity-test-chest')(web3);
const { buildCoinDistAndExchange } = require('./builders');

const AMBMock = contract.fromArtifact('AMBMock');
const StakingHomeMediator = contract.fromArtifact('StakingHomeMediator');
const YALLEmissionRewardPool = contract.fromArtifact('YALLEmissionRewardPool');

StakingHomeMediator.numberFormat = 'String';
YALLEmissionRewardPool.numberFormat = 'String';

const keccak256 = web3.utils.soliditySha3;

describe('YALLEmissionReward Integration tests', () => {
  const [
    alice,
    bob,
    charlie,
    mediatorOnTheOtherSide,
    distributorVerifier,
    yallMinter,
    feeManager,
    feeCollector,
    gsnFeeCollector,
    exchangeManager,
    exchangeOperator,
    exchangeSuperOperator,
    yallTokenManager,
    v1,
    v2,
    v3,
  ] = accounts;
  const memberId1 = keccak256('bob');
  const periodLength = 7 * 24 * 60 * 60;

  let homeMediator;
  let bridge;
  let yallToken;
  let dist;
  let verification;
  let emission;

  beforeEach(async function () {
    bridge = await AMBMock.new();
    await bridge.setMaxGasPerTx(2000000);
    ({ yallToken, dist, emission, homeMediator, verification } = await buildCoinDistAndExchange(defaultSender, {
      distributorVerifier,
      yallMinter,
      feeManager,
      feeCollector,
      gsnFeeCollector,
      exchangeManager,
      exchangeOperator,
      exchangeSuperOperator,
      yallTokenManager,
      mediatorOnTheOtherSide,
      bridge: bridge.address,
    }));
  });

  // Test Cases:
  it('should correctly handle emission distribution', async function () {
    const step1 = (await now()) - 100;
    const step2 = (await now()) - 50;

    const data1 = await homeMediator.contract.methods.setCachedBalance(alice, ether(30), ether(30), step1).encodeABI();
    const data2 = await homeMediator.contract.methods.setCachedBalance(bob, ether(20), ether(50), step2).encodeABI();
    await bridge.executeMessageCall(homeMediator.address, mediatorOnTheOtherSide, data1, keccak256('blah'), 2000000);
    await bridge.executeMessageCall(homeMediator.address, mediatorOnTheOtherSide, data2, keccak256('blah'), 2000000);

    assert.equal(await homeMediator.balanceOfAt(alice, step1), ether(30));
    assert.equal(await homeMediator.balanceOfAt(bob, step2), ether(20));
    assert.equal(await homeMediator.totalSupplyAt(step2), ether(50));

    await dist.addMembersBeforeGenesis([memberId1], [bob], { from: distributorVerifier });
    assert.equal(await dist.emissionPoolRewardShare(), ether(10));

    await verification.addVerifiers([v1, v2, v3]);

    // TODO: set delegate balance
    // TODO: add verifiers
    await increaseTime(21);

    // Add verifiers
    await dist.handlePeriodTransitionIfRequired();

    // period #0
    assert.equal(await dist.getCurrentPeriodId(), 0);
    let res = await dist.period(0);
    assert.equal(res.emissionPoolRewardTotal, ether(25));
    assert.equal(res.emissionPoolRewardClaimed, 0);

    let v1BalanceBefore = await yallToken.balanceOf(v1);
    await emission.claimVerifierReward({ from: v1 });
    let v1BalanceAfter = await yallToken.balanceOf(v1);
    // v1Reward = 25 * (60/100) * (1/3) = 5
    await assertErc20BalanceChanged(v1BalanceBefore, v1BalanceAfter, ether(5));

    res = await dist.period(0);
    assert.equal(res.emissionPoolRewardTotal, ether(25));
    assert.equal(res.emissionPoolRewardClaimed, ether(5));

    await assertRevert(
      emission.claimVerifierReward({ from: v1 }),
      'YALLEmissionRewardPool: Already claimed for the current period'
    );

    await verification.addVerifiers([alice, charlie]);

    // period #1
    await increaseTime(periodLength);
    assert.equal(await dist.getCurrentPeriodId(), 1);

    v1BalanceBefore = await yallToken.balanceOf(v1);
    await emission.claimVerifierReward({ from: v1 });
    v1BalanceAfter = await yallToken.balanceOf(v1);
    // v1Reward = 25 * (60/100) * (1/5) = 3
    await assertErc20BalanceChanged(v1BalanceBefore, v1BalanceAfter, ether(3));

    assert.equal(await emission.getPeriodTotalDelegatorsReward(1), ether(10));
    assert.equal(await emission.getPeriodTotalVerifiersReward(1), ether(15));

    let aliceBalanceBefore = await yallToken.balanceOf(alice);
    await emission.claimDelegatorReward(1, { from: alice });
    let aliceBalanceAfter = await yallToken.balanceOf(alice);
    // v1Reward = 25 * (40/100) * (30/50) = 9
    await assertErc20BalanceChanged(aliceBalanceBefore, aliceBalanceAfter, ether(6));

    aliceBalanceBefore = await yallToken.balanceOf(alice);
    await emission.claimDelegatorReward(0, { from: alice });
    aliceBalanceAfter = await yallToken.balanceOf(alice);
    // v1Reward = 25 * (40/100) * (30/50) = 9
    await assertErc20BalanceChanged(aliceBalanceBefore, aliceBalanceAfter, ether(6));
  });
});
