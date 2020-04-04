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
const {
    deployRelayHub,
    fundRecipient,
} = require('@openzeppelin/gsn-helpers');

const CoinToken = contract.fromArtifact('CoinToken');
const YALDistributor = contract.fromArtifact('YALDistributor');

CoinToken.numberFormat = 'String';
YALDistributor.numberFormat = 'String';

const { ether, now, getEventArg, increaseTime, assertRevert, assertGsnReject } = require('@galtproject/solidity-test-chest')(web3);
const { approveFunction } = require('./helpers')(web3);

const keccak256 = web3.utils.soliditySha3;

describe('YALDistribution Integration Tests', () => {
    const [verifier, alice, bob, charlie, dan, eve, anyone] = accounts;

    // 7 days
    const periodLength = 7 * 24 * 60 * 60;
    const periodVolume = ether(250 * 1000);
    const verifierRewardShare = ether(10);
    const baseAliceBalance = 10000000;
    const feePercent = 0.02;
    const startAfter = 10;
    const memberId0 = keccak256('alice');
    const memberId1 = keccak256('bob');
    const memberId2 = keccak256('charlie');
    const memberId3 = keccak256('dan');
    const memberId4 = keccak256('eve');
    let genesisTimestamp;
    let coinToken;
    let dist;

    beforeEach(async function () {
        genesisTimestamp = parseInt(await now(), 10) + startAfter;
        coinToken = await CoinToken.new(alice, "Coin token", "COIN", 18);
        dist = await YALDistributor.new();
        await dist.initialize(
            periodVolume,
            verifier,
            verifierRewardShare,

            coinToken.address,
            periodLength,
            genesisTimestamp
        );

        await coinToken.mint(alice, ether(baseAliceBalance));
        await coinToken.setTransferFee(ether(10));
        await coinToken.addRoleTo(dist.address, "minter");
        await coinToken.setDistributor(dist.address);

        // this will affect on dist provider too
        coinToken.contract.currentProvider.wrappedProvider.relayClient.approveFunction = approveFunction;

        await deployRelayHub(web3);
        await fundRecipient(web3, { recipient: dist.address, amount: ether(1) });
    });

    it('should not allow 2nd initialize call', async function() {
        await assertRevert(
            dist.initialize(
            periodVolume,
            verifier,
            verifierRewardShare,

            coinToken.address,
            periodLength,
            genesisTimestamp
            ),
            'Contract instance has already been initialized'
        );
    });

    it('should allow single member claiming his funds', async function() {
        await dist.addMembersBeforeGenesis([memberId1], [bob], { from: verifier });

        await assertRevert(
            dist.claimFunds({ from: bob, useGSN: true }),
            'Contract not initiated yet',
        );
        await assertRevert(dist.claimFunds({ from: bob, useGSN: false }), 'Contract not initiated yet');

        const member = await dist.getMemberByAddress(bob);
        assert.equal(member.id, memberId1);
        assert.equal(member.addr, bob);

        await increaseTime(21);

        // period #0
        assert.equal(await dist.getCurrentPeriodId(), 0);

        await dist.claimFunds({ from: bob, useGSN: true });
        await assertRevert(dist.claimFunds({ from: bob }), 'Already claimed for the current period');

        let res = await dist.period(0);
        assert.equal(res.verifierReward, ether(25 * 1000));
        assert.equal(res.rewardPerMember, ether(225 * 1000));

        // period #1
        await increaseTime(11 + periodLength);

        await dist.claimFunds({ from: bob });
        await assertRevert(dist.claimFunds({ from: bob, useGSN: true }), 'Already claimed for the current period');

        res = await dist.period(1);
        assert.equal(res.verifierReward, ether(25 * 1000));
        assert.equal(res.rewardPerMember, ether(225 * 1000));
    });

    it('should allow increasing number of members claiming their funds', async function() {
        // before genesis
        await assertRevert(dist.claimFunds({ from: bob }), 'Contract not initiated yet');
        await dist.addMembersBeforeGenesis([memberId1], [bob], { from: verifier });

        await increaseTime(11);

        // period #0
        assert.equal(await dist.getCurrentPeriodId(), 0);

        await dist.claimFundsMultiple([bob], { from: verifier });
        await assertRevert(dist.claimFunds({ from: bob }), 'Already claimed for the current period');

        let res = await dist.period(0);
        assert.equal(res.verifierReward, ether(25 * 1000));
        assert.equal(res.rewardPerMember, ether(225 * 1000));

        // add 2 more
        await dist.addMembers([memberId2, memberId3], [dan, charlie], { from: verifier });
        // change verifier reward
        await dist.setVerifierRewardShare(ether(25));

        // check this doesn't affect the already calculated rewards
        res = await dist.period(0);
        assert.equal(res.verifierReward, ether(25 * 1000));
        assert.equal(res.rewardPerMember, ether(225 * 1000));

        // period #1
        await increaseTime(11 + periodLength);

        await dist.claimFunds({ from: bob, useGSN: true });
        await assertRevert(dist.claimFunds({ from: bob }), 'Already claimed for the current period');

        res = await dist.period(1);
        assert.equal(res.verifierReward, ether(62.5 * 1000));
        assert.equal(res.rewardPerMember, ether(62.5 * 1000));
    });

    describe('activate/deactivate', () => {
        beforeEach(async function() {
            await dist.addMembersBeforeGenesis([memberId1, memberId2, memberId3], [bob, charlie, dan], { from: verifier });
            await increaseTime(15 + 1 * periodLength);
        })

        it('should allow claiming a reward only once if disabled/enabled in the same period', async function() {
            // P1
            assert.equal(await dist.getCurrentPeriodId(), 1);
            await dist.claimFunds({ from: bob, useGSN: true });

            let res = await dist.period(1);
            assert.equal(res.rewardPerMember, ether(75 * 1000));

            await dist.disableMembers([bob], { from: verifier });
            await increaseTime(0.5 * periodLength);
            await dist.enableMembers([bob], { from: verifier });

            await assertRevert(dist.claimFunds({ from: bob }), 'Already claimed for the current period');

            // P2
            await increaseTime(11 + periodLength);
            await dist.claimFunds({ from: bob });

            res = await dist.period(2);
            assert.equal(res.rewardPerMember, ether(75 * 1000));
        });

        it('should allow claiming reward after being disabled/enabled', async function() {
            // P1
            await dist.claimFunds({ from: bob, useGSN: true });

            let res = await dist.period(1);
            assert.equal(res.rewardPerMember, ether(75 * 1000));

            await dist.disableMembers([bob], { from: verifier });
            await dist.enableMembers([bob], { from: verifier });
            await increaseTime(0.5 * periodLength);

            await assertRevert(dist.claimFunds({ from: bob }), 'Already claimed for the current period');

            // P2
            await increaseTime(11 + periodLength);
            await dist.claimFunds({ from: bob });

            res = await dist.period(2);
            assert.equal(res.rewardPerMember, ether(75 * 1000));
        });

        it('should deny me claiming a reward if disabled at P1 and enabled at P2', async function() {
            // P1
            assert.equal(await dist.getCurrentPeriodId(), 1);
            await dist.claimFunds({ from: bob, useGSN: true });

            await dist.disableMembers([bob], { from: verifier });
            await increaseTime(periodLength);

            let res = await dist.period(1);
            assert.equal(res.rewardPerMember, ether(75 * 1000));

            // P2
            assert.equal(await dist.getCurrentPeriodId(), 2);
            await dist.enableMembers([bob], { from: verifier });

            await assertRevert(
                dist.claimFunds({ from: bob }),
               'One period should be skipped after re-enabling'
            );

            res = await dist.period(2);
            assert.equal(res.rewardPerMember, ether(112.5 * 1000));

            // but allow at P3
            await increaseTime(11 + periodLength);
            assert.equal(await dist.getCurrentPeriodId(), 3);
            await dist.claimFunds({ from: bob });

            res = await dist.period(3);
            assert.equal(res.rewardPerMember, ether(75 * 1000));

            // and at P4
            await increaseTime(periodLength);
            assert.equal(await dist.getCurrentPeriodId(), 4);
            await dist.claimFunds({ from: bob });

            res = await dist.period(4);
            assert.equal(res.rewardPerMember, ether(75 * 1000));
        });

        it('should deny me claiming a reward if disabled at P1 and enabled at P3', async function() {
            // P1
            assert.equal(await dist.getCurrentPeriodId(), 1);
            await dist.claimFunds({ from: bob });

            await dist.disableMembers([bob], { from: verifier });

            let res = await dist.period(1);
            assert.equal(res.rewardPerMember, ether(75 * 1000));

            // is disabled at P2
            await increaseTime(periodLength);
            assert.equal(await dist.getCurrentPeriodId(), 2);

            await assertRevert(
                dist.claimFunds({ from: bob }),
                'Not active member'
            );

            // period 2 reward was not distributed since no one had claimed it
            res = await dist.period(2);
            assert.equal(res.rewardPerMember, ether(0));

            // still deny at P3
            await increaseTime(periodLength);
            assert.equal(await dist.getCurrentPeriodId(), 3);
            // enable at P3
            await dist.enableMembers([bob], { from: verifier });

            await assertRevert(
                dist.claimFunds({ from: bob }),
                'One period should be skipped after re-enabling'
            );

            res = await dist.period(3);
            assert.equal(res.rewardPerMember, ether(112.5 * 1000));

            // but allow at P4
            await increaseTime(periodLength);
            assert.equal(await dist.getCurrentPeriodId(), 4);
            await dist.claimFunds({ from: bob });

            res = await dist.period(4);
            assert.equal(res.rewardPerMember, ether(75 * 1000));
        });
    })

    describe('Active member caching', () => {
        it('should correctly cache active member addresses', async function() {
            await dist.addMembersBeforeGenesis([memberId1, memberId2, memberId3], [bob, charlie, dan], { from: verifier });
            assert.sameMembers(await dist.getActiveAddressList(), [bob, charlie, dan]);
            assert.equal(await dist.getActiveAddressSize(), 3);

            await increaseTime(11);

            await dist.disableMembers([bob, charlie], { from: verifier });
            assert.sameMembers(await dist.getActiveAddressList(), [dan]);
            assert.equal(await dist.getActiveAddressSize(), 1);

            await dist.disableMembers([dan], { from: verifier });
            assert.sameMembers(await dist.getActiveAddressList(), []);
            assert.equal(await dist.getActiveAddressSize(), 0);

            await dist.addMember(memberId0, alice, { from: verifier });
            assert.sameMembers(await dist.getActiveAddressList(), [alice]);
            assert.equal(await dist.getActiveAddressSize(), 1);

            await dist.enableMembers([bob, charlie, dan], { from: verifier });
            assert.sameMembers(await dist.getActiveAddressList(), [alice, bob, charlie, dan]);
            assert.equal(await dist.getActiveAddressSize(), 4);

            await dist.addMembers([memberId4], [eve], { from: verifier });
            assert.sameMembers(await dist.getActiveAddressList(), [alice, bob, charlie, dan, eve]);
            assert.equal(await dist.getActiveAddressSize(), 5);
        })
    });

    describe('Active member caching', () => {
        it('should emit event on a period change', async function() {
            // PG
            await dist.addMembersBeforeGenesis([memberId1, memberId2], [bob, charlie], { from: verifier });

            // P0
            await increaseTime(12);
            assert.equal(await dist.getCurrentPeriodId(), 0);

            let res = await dist.addMember(memberId3, dan, { from: verifier });

            assert.equal(getEventArg(res, 'PeriodChange', 'newPeriodId'), 0);
            assert.equal(getEventArg(res, 'PeriodChange', 'volume'), ether(250 * 1000));
            assert.equal(getEventArg(res, 'PeriodChange', 'verifierReward'), ether(25 * 1000));
            assert.equal(getEventArg(res, 'PeriodChange', 'rewardPerMember'), ether(112.5 * 1000));
            assert.equal(getEventArg(res, 'PeriodChange', 'activeMemberCount'), 2);

            // change verifier reward
            await dist.setVerifierRewardShare(ether(40));
            await dist.setPeriodVolume(ether(1000 * 1000));
            assert.equal(await dist.verifierRewardShare(), ether(40));
            assert.equal(await dist.periodVolume(), ether(1000 * 1000));

            // P1
            await increaseTime(periodLength);
            assert.equal(await dist.getCurrentPeriodId(), 1);

            res = await dist.claimFunds({ from: dan });

            assert.equal(getEventArg(res, 'PeriodChange', 'newPeriodId'), 1);
            assert.equal(getEventArg(res, 'PeriodChange', 'volume'), ether(1000 * 1000));
            assert.equal(getEventArg(res, 'PeriodChange', 'verifierReward'), ether(400 * 1000));
            assert.equal(getEventArg(res, 'PeriodChange', 'rewardPerMember'), ether(200 * 1000));
            assert.equal(getEventArg(res, 'PeriodChange', 'activeMemberCount'), 3);
        })
    });

    describe('When paused', () => {
        it('should deny executing contracts', async function() {
            await dist.addMembersBeforeGenesis([memberId1, memberId2, memberId3], [bob, charlie, dan], { from: verifier });
            await increaseTime(15 + 1 * periodLength);

            await dist.pause();
            assert.equal(await dist.paused(), true);

            assert.equal(await dist.getCurrentPeriodId(), 1);

            await assertRevert(
                dist.claimFunds({ from: bob }),
                'Contract is paused'
            );
            await assertRevert(
                dist.claimVerifierReward(0, bob, { from: verifier }),
                'Contract is paused'
            );
            await assertRevert(
                dist.changeMyAddress(alice, { from: charlie }),
                'Contract is paused'
            );
        });
    });
});
