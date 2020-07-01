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
const {
  ether,
  now,
  increaseTime,
  assertRevert,
  assertErc20BalanceChanged,
} = require('@galtproject/solidity-test-chest')(web3);
const BigNumber = require('bignumber.js');
const { assert } = require('chai');
const { buildCoinDistAndExchange } = require('./builders');

const YALLFeeCollector = contract.fromArtifact('YALLFeeCollector');
const AMBMock = contract.fromArtifact('AMBMock');

const keccak256 = web3.utils.soliditySha3;
BigNumber.set({ ROUNDING_MODE: BigNumber.ROUND_DOWN, DECIMAL_PLACES: 0, EXPONENTIAL_AT: [-30, 30] });
const HUNDRED_PCT = new BigNumber(ether(100));

describe('YALLCommissionReward Integration tests', () => {
  const [
    alice,
    bob,
    charlie,
    mediatorOnTheOtherSide,
    commissionRewardPoolManager,
    distributorVerifier,
    yallMinter,
    feeManager,
    governance,
    yallTokenManager,
    v1,
    v2,
    v3,
    v4,
    v1Payout,
    v2Payout,
    v3Payout,
    v4Payout,
    bar,
    buzz,
  ] = accounts;

  const memberId1 = keccak256('bob');
  const memberId2 = keccak256('charlie');
  const memberId4 = keccak256('eve');
  const periodLength = 7 * 24 * 60 * 60;
  const txFee = ether('0.02');

  BigNumber.prototype.deductTxFee = function () {
    return this.minus(this.multipliedBy(txFee).dividedBy(HUNDRED_PCT));
  };

  let homeMediator;
  let bridge;
  let yallToken;
  let dist;
  let commission;
  let verification;
  let registry;
  let feeCollector;

  beforeEach(async function () {
    bridge = await AMBMock.new();
    await bridge.setMaxGasPerTx(2000000);
    ({ registry, yallToken, dist, homeMediator, verification, commission } = await buildCoinDistAndExchange(
      defaultSender,
      {
        distributorVerifier,
        yallMinter,
        feeManager,
        yallTokenManager,
        mediatorOnTheOtherSide,
        commissionRewardPoolManager,
        governance,
        feeCollector: alice,
        gsnFeeCollector: alice,
        bridge: bridge.address,
        disableExchange: true,
        disableEmission: true,
      }
    ));
    feeCollector = await YALLFeeCollector.new(registry.address);
    await registry.setContract(await registry.YALL_FEE_COLLECTOR_KEY(), feeCollector.address);

    await yallToken.setTransferFee(txFee, { from: feeManager });
    await yallToken.setCanTransferWhitelistAddress(v1, true, { from: yallTokenManager });
    await yallToken.setCanTransferWhitelistAddress(v2, true, { from: yallTokenManager });
    await yallToken.setCanTransferWhitelistAddress(v3, true, { from: yallTokenManager });
    await yallToken.setCanTransferWhitelistAddress(v4, true, { from: yallTokenManager });
    await yallToken.setCanTransferWhitelistAddress(alice, true, { from: yallTokenManager });
  });

  it('should distribute commission rewards correctly', async function () {
    const step1 = (await now()) - 100;
    const step2 = (await now()) - 50;

    const data1 = await homeMediator.contract.methods.setCachedBalance(alice, ether(30), ether(30), step1).encodeABI();
    const data2 = await homeMediator.contract.methods.setCachedBalance(bob, ether(20), ether(50), step2).encodeABI();
    await bridge.executeMessageCall(homeMediator.address, mediatorOnTheOtherSide, data1, keccak256('blah'), 2000000);
    await bridge.executeMessageCall(homeMediator.address, mediatorOnTheOtherSide, data2, keccak256('blah'), 2000000);

    assert.equal(await homeMediator.balanceOfAt(alice, step1), ether(30));
    assert.equal(await homeMediator.balanceOfAt(bob, step2), ether(20));
    assert.equal(await homeMediator.totalSupplyAt(step2), ether(50));

    await dist.addMembersBeforeGenesis([memberId1, memberId2], [bob, charlie], { from: distributorVerifier });
    assert.equal(await dist.emissionPoolRewardShare(), ether(10));

    await verification.setVerifiers([v1, v2, v3], 2, { from: governance });

    await verification.setVerifierAddresses(bar, v1Payout, buzz, { from: v1 });
    await verification.setVerifierAddresses(bar, v2Payout, buzz, { from: v2 });
    await verification.setVerifierAddresses(bar, v3Payout, buzz, { from: v3 });

    await yallToken.setCanTransferWhitelistAddress(v1Payout, true, { from: yallTokenManager });
    await yallToken.setCanTransferWhitelistAddress(v2Payout, true, { from: yallTokenManager });
    await yallToken.setCanTransferWhitelistAddress(v3Payout, true, { from: yallTokenManager });

    await increaseTime(21);

    // Transfer some funds to the sources
    await yallToken.setCanTransferWhitelistAddress(feeCollector.address, true, { from: yallTokenManager });
    await yallToken.setNoTransferFeeWhitelistAddress(feeCollector.address, true, { from: yallTokenManager });
    await yallToken.mint(feeCollector.address, ether(42), { from: yallMinter });

    const expectedTotalRewardP0 = new BigNumber(ether(41));
    const expectedVerifierRewardP0 = expectedTotalRewardP0.multipliedBy(ether(10)).dividedBy(HUNDRED_PCT).dividedBy(3);
    const expectedMemberRewardP0 = expectedTotalRewardP0.multipliedBy(ether(50)).dividedBy(HUNDRED_PCT).dividedBy(2);
    const expectedAliceRewardP0 = expectedTotalRewardP0
      .multipliedBy(ether(40))
      .dividedBy(HUNDRED_PCT)
      .multipliedBy(30)
      .dividedBy(50);
    const expectedBobsRewardP0 = expectedTotalRewardP0
      .multipliedBy(ether(40))
      .dividedBy(HUNDRED_PCT)
      .multipliedBy(20)
      .dividedBy(50);

    let res = await commission.handlePeriodTransitionIfRequired();
    let periodChangeLog = res.logs[1].args;
    assert.equal(periodChangeLog.newPeriodId, 0);
    assert.equal(periodChangeLog.totalReward, expectedTotalRewardP0.toString());
    assert.equal(
      periodChangeLog.totalDelegatorsReward,
      expectedTotalRewardP0.multipliedBy(ether(40)).dividedBy(HUNDRED_PCT).toString()
    );
    assert.equal(
      periodChangeLog.totalVerifiersReward,
      expectedTotalRewardP0.multipliedBy(ether(10)).dividedBy(HUNDRED_PCT).toString()
    );
    assert.equal(
      periodChangeLog.totalMembersReward,
      expectedTotalRewardP0.multipliedBy(ether(50)).dividedBy(HUNDRED_PCT).toString()
    );
    assert.equal(periodChangeLog.previousUnclaimedVerifiersReward, 0);
    assert.equal(periodChangeLog.previousUnclaimedMembersReward, 0);
    assert.equal(periodChangeLog.verifierReward, expectedVerifierRewardP0.toString());
    assert.equal(periodChangeLog.memberReward, expectedMemberRewardP0.toString());
    assert.equal(periodChangeLog.activeVerifierCount, 3);
    assert.equal(periodChangeLog.activeMemberCount, 2);

    // period #0
    assert.equal(await dist.getCurrentPeriodId(), 0);
    res = await commission.periods(0);

    assert.equal(res.totalReward, expectedTotalRewardP0.toString());
    assert.equal(
      res.totalDelegatorsReward,
      expectedTotalRewardP0.multipliedBy(ether(40)).dividedBy(HUNDRED_PCT).toString()
    );
    assert.equal(
      res.totalVerifiersReward,
      expectedTotalRewardP0.multipliedBy(ether(10)).dividedBy(HUNDRED_PCT).toString()
    );
    assert.equal(
      res.totalMembersReward,
      expectedTotalRewardP0.multipliedBy(ether(50)).dividedBy(HUNDRED_PCT).toString()
    );
    // there were 3 verifiers active at the beginning of the 0th period
    assert.equal(res.verifierReward, expectedVerifierRewardP0.toString());
    // there were 2 members active at the beginning of the 0th period
    assert.equal(res.memberReward, expectedMemberRewardP0.toString());
    assert.equal(res.claimedVerifiersReward, 0);
    assert.equal(res.claimedMembersReward, 0);

    // verifier can claim reward for 0th period
    const v1BalanceBefore = await yallToken.balanceOf(v1Payout);
    await commission.claimVerifierReward(v1, { from: v1Payout });
    const v1BalanceAfter = await yallToken.balanceOf(v1Payout);
    await assertErc20BalanceChanged(v1BalanceBefore, v1BalanceAfter, expectedVerifierRewardP0.toString());

    // delegator bob can  claim reward for 0th period
    const bobsBalanceBefore = await yallToken.balanceOf(bob);
    await commission.claimDelegatorReward(0, { from: bob });
    const bobsBalanceAfter = await yallToken.balanceOf(bob);
    await assertErc20BalanceChanged(bobsBalanceBefore, bobsBalanceAfter, expectedBobsRewardP0.toString());

    // can't claim again
    await assertRevert(
      commission.claimVerifierReward(v1, { from: v1Payout }),
      'YALLCommissionRewardPool: Already claimed for the current period'
    );

    // a new added verifier can't claim a reward
    await verification.setVerifiers([v1, v2, v3, v4], 3, { from: governance });

    await verification.setVerifierAddresses(bar, v4Payout, buzz, { from: v4 });
    await yallToken.setCanTransferWhitelistAddress(v4Payout, true, { from: yallTokenManager });

    await assertRevert(
      commission.claimVerifierReward(v4, { from: v4Payout }),
      "YALLRewardClaimer: Can't assign rewards for the creation period"
    );

    // change shares (delegators/verifiers/members)
    await commission.setShares(ether(10), ether(60), ether(30), { from: commissionRewardPoolManager });
    // change verifiers
    await verification.setVerifiers([v1, v2, v4], 3, { from: governance });
    // change members
    await dist.addMembers([memberId4], [alice], { from: distributorVerifier });

    await yallToken.mint(feeCollector.address, ether(20), { from: yallMinter });

    // period #0 has finished, delegates [alice], verifiers[v2, v3] and members [bob, charlie] did't claim their rewards
    // period #1 starts
    // ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
    await increaseTime(periodLength);
    assert.equal(await dist.getCurrentPeriodId(), 1);
    // transition has not been triggered yet
    res = await commission.periods(1);
    assert.equal(res.totalReward, 0);

    // the reward was withdrawn only from exchange, where 20eth were minted, 1 left from previous period
    // and also 1 was kept again
    const expectedTotalRewardP1 = new BigNumber('20000000000000000000');
    const p0VerifiersLeftover = new BigNumber('2733333333333333334');
    const p0MembersLeftover = new BigNumber('20500000000000000000');
    const expectedVerifiersRewardP1 = expectedTotalRewardP1
      .multipliedBy(ether(60))
      .dividedBy(HUNDRED_PCT)
      .plus(p0VerifiersLeftover);
    const expectedMembersRewardP1 = expectedTotalRewardP1
      .multipliedBy(ether(30))
      .dividedBy(HUNDRED_PCT)
      .plus(p0MembersLeftover);
    const expectedVerifierRewardP1 = expectedVerifiersRewardP1.dividedBy(3);
    const expectedMemberRewardP1 = expectedMembersRewardP1.dividedBy(3);
    const expectedAliceRewardP1 = expectedTotalRewardP1
      .multipliedBy(ether(10))
      .dividedBy(HUNDRED_PCT)
      .multipliedBy(30)
      .dividedBy(50);

    // alice claims reward for 0th period
    let aliceBalanceBefore = await yallToken.balanceOf(alice);
    res = await commission.claimDelegatorReward(0, { from: alice });
    let aliceBalanceAfter = await yallToken.balanceOf(alice);
    await assertErc20BalanceChanged(aliceBalanceBefore, aliceBalanceAfter, expectedAliceRewardP0.toString());
    periodChangeLog = res.logs[1].args;
    assert.equal(periodChangeLog.newPeriodId, 1);
    assert.equal(periodChangeLog.totalReward, expectedTotalRewardP1.toString());
    assert.equal(
      periodChangeLog.totalDelegatorsReward,
      expectedTotalRewardP1.multipliedBy(ether(10)).dividedBy(HUNDRED_PCT).toString()
    );
    assert.equal(
      periodChangeLog.totalVerifiersReward,
      expectedTotalRewardP1
        .multipliedBy(ether(60))
        .dividedBy(HUNDRED_PCT)
        .plus(periodChangeLog.previousUnclaimedVerifiersReward)
        .toString()
    );
    assert.equal(
      periodChangeLog.totalMembersReward,
      expectedTotalRewardP1
        .multipliedBy(ether(30))
        .dividedBy(HUNDRED_PCT)
        .plus(periodChangeLog.previousUnclaimedMembersReward)
        .toString()
    );
    assert.equal(periodChangeLog.previousUnclaimedVerifiersReward, p0VerifiersLeftover.toString());
    assert.equal(periodChangeLog.previousUnclaimedMembersReward, p0MembersLeftover.toString());
    assert.equal(periodChangeLog.verifierReward, expectedVerifierRewardP1.toString());
    assert.equal(periodChangeLog.memberReward, expectedMemberRewardP1.toString());
    assert.equal(periodChangeLog.activeVerifierCount, 3);
    assert.equal(periodChangeLog.activeMemberCount, 3);

    res = await commission.periods(1);
    assert.equal(res.totalReward, expectedTotalRewardP1.toString());
    assert.equal(
      res.totalDelegatorsReward,
      expectedTotalRewardP1.multipliedBy(ether(10)).dividedBy(HUNDRED_PCT).toString()
    );
    assert.equal(res.totalVerifiersReward, expectedVerifiersRewardP1.toString());
    assert.equal(res.totalMembersReward, expectedMembersRewardP1.toString());
    // there were 3 verifiers active at the beginning of the 0th period
    assert.equal(res.verifierReward, expectedVerifierRewardP1.toString());
    // there were 2 members active at the beginning of the 0th period
    assert.equal(res.memberReward, expectedMemberRewardP1.toString());
    assert.equal(res.claimedVerifiersReward, 0);
    assert.equal(res.claimedMembersReward, 0);

    // alice claims reward for 1th period
    aliceBalanceBefore = await yallToken.balanceOf(alice);
    await commission.claimDelegatorReward(1, { from: alice });
    aliceBalanceAfter = await yallToken.balanceOf(alice);
    await assertErc20BalanceChanged(aliceBalanceBefore, aliceBalanceAfter, expectedAliceRewardP1.toString());

    // can't claim again
    await assertRevert(
      commission.claimDelegatorReward(1, { from: alice }),
      'YALLCommissionRewardPool: Already claimed for the current period'
    );

    // everyone claims their reward...
    await commission.claimDelegatorReward(1, { from: bob });
    await commission.claimVerifierReward(v1, { from: v1Payout });
    await commission.claimVerifierReward(v2, { from: v2Payout });
    await commission.claimVerifierReward(v4, { from: v4Payout });
    await commission.claimMemberReward({ from: alice });
    await commission.claimMemberReward({ from: bob });
    await commission.claimMemberReward({ from: charlie });

    // period #1 has finished, everyone claimed their reward
    // period #2 starts
    // ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
    await increaseTime(periodLength);

    assert.equal(await dist.getCurrentPeriodId(), 2);
    // transition has not been triggered yet
    res = await commission.periods(2);
    assert.equal(res.totalReward, 0);

    res = await commission.handlePeriodTransitionIfRequired();
    periodChangeLog = res.logs[1].args;
    assert.equal(periodChangeLog.newPeriodId, 2);
    assert.equal(periodChangeLog.totalReward, 0);
    assert.equal(periodChangeLog.totalDelegatorsReward, 0);
    assert.equal(periodChangeLog.totalVerifiersReward, 1);
    assert.equal(periodChangeLog.totalMembersReward, 1);
    assert.equal(periodChangeLog.previousUnclaimedVerifiersReward, 1);
    assert.equal(periodChangeLog.previousUnclaimedMembersReward, 1);
    assert.equal(periodChangeLog.verifierReward, 0);
    assert.equal(periodChangeLog.memberReward, 0);
    assert.equal(periodChangeLog.activeVerifierCount, 3);
    assert.equal(periodChangeLog.activeMemberCount, 3);
  });
});
