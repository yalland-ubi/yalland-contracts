/*
 * Copyright ©️ 2020 Galt•Project Society Construction and Terraforming Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka)
 *
 * Copyright ©️ 2020 Galt•Core Blockchain Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka) by
 * [Basic Agreement](ipfs/QmaCiXUmSrP16Gz8Jdzq6AJESY1EAANmmwha15uR3c1bsS)).
 */

const { accounts, defaultSender, contract, web3 } = require('@openzeppelin/test-environment');
const { assert } = require('chai');

const CoinToken = contract.fromArtifact('CoinToken');
const YALDistributor = contract.fromArtifact('YALDistributor');

CoinToken.numberFormat = 'String';
YALDistributor.numberFormat = 'String';

const { ether, now, int, increaseTime, assertRevert, zeroAddress, getResTimestamp } = require('@galtproject/solidity-test-chest')(web3);

const keccak256 = web3.utils.soliditySha3;

describe('YALDistribution Integration Tests', () => {
    const [pauser, verifier, alice, bob, charlie, dan] = accounts;
    const deployer = defaultSender;

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
    let coinToken;
    let dist;

    beforeEach(async function () {
        genesisTimestamp = parseInt(await now(), 10) + startAfter;
        coinToken = await CoinToken.new("Coin token", "COIN", 18);
        dist = await YALDistributor.new(
            periodVolume,
            verifier,
            verifierRewardShare,

            coinToken.address,
            periodLength,
            genesisTimestamp
        );

        await coinToken.mint(alice, ether(baseAliceBalance));
        await coinToken.setTransferFee(web3.utils.toWei(feePercent.toString(), 'szabo'));
        await coinToken.addRoleTo(dist.address, "minter");
    });

    it('should allow single member claiming his funds', async function() {
        // before genesis
        await assertRevert(dist.claimFunds(memberId1, { from: bob }), 'Contract not initiated yet');
        await dist.addMembersBeforeGenesis([memberId1], [bob], { from: verifier });

        await increaseTime(11);

        // period #0
        assert.equal(await dist.getCurrentPeriodId(), 0);

        await dist.claimFunds(memberId1, { from: bob });
        await assertRevert(dist.claimFunds(memberId1, { from: bob }), 'Already claimed for the current period');

        let res = await dist.period(0);
        assert.equal(res.verifierReward, ether(25 * 1000));
        assert.equal(res.rewardPerMember, ether(225 * 1000));

        // period #1
        await increaseTime(11 + periodLength);

        await dist.claimFunds(memberId1, { from: bob });
        await assertRevert(dist.claimFunds(memberId1, { from: bob }), 'Already claimed for the current period');

        res = await dist.period(1);
        assert.equal(res.verifierReward, ether(25 * 1000));
        assert.equal(res.rewardPerMember, ether(225 * 1000));
    });

    it('should allow increasing number of members claiming their funds', async function() {
        // before genesis
        await assertRevert(dist.claimFunds(memberId1, { from: bob }), 'Contract not initiated yet');
        await dist.addMembersBeforeGenesis([memberId1], [bob], { from: verifier });

        await increaseTime(11);

        // period #0
        assert.equal(await dist.getCurrentPeriodId(), 0);

        await dist.claimFunds(memberId1, { from: bob });
        await assertRevert(dist.claimFunds(memberId1, { from: bob }), 'Already claimed for the current period');

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

        await dist.claimFunds(memberId1, { from: bob });
        await assertRevert(dist.claimFunds(memberId1, { from: bob }), 'Already claimed for the current period');

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
            await dist.claimFunds(memberId1, { from: bob });

            let res = await dist.period(1);
            assert.equal(res.rewardPerMember, ether(75 * 1000));

            await dist.disableMembers([memberId1], { from: verifier });
            await increaseTime(0.5 * periodLength);
            await dist.enableMembers([memberId1], { from: verifier });

            await assertRevert(dist.claimFunds(memberId1, { from: bob }), 'Already claimed for the current period');

            // P2
            await increaseTime(11 + periodLength);
            await dist.claimFunds(memberId1, { from: bob });

            res = await dist.period(2);
            assert.equal(res.rewardPerMember, ether(75 * 1000));
        });

        it('should allow claiming reward after being disabled/enabled', async function() {
            // P1
            await dist.claimFunds(memberId1, { from: bob });

            let res = await dist.period(1);
            assert.equal(res.rewardPerMember, ether(75 * 1000));

            await dist.disableMembers([memberId1], { from: verifier });
            await dist.enableMembers([memberId1], { from: verifier });
            await increaseTime(0.5 * periodLength);

            await assertRevert(dist.claimFunds(memberId1, { from: bob }), 'Already claimed for the current period');

            // P2
            await increaseTime(11 + periodLength);
            await dist.claimFunds(memberId1, { from: bob });

            res = await dist.period(2);
            assert.equal(res.rewardPerMember, ether(75 * 1000));
        });

        it('should deny me claiming a reward if disabled at P1 and enabled at P2', async function() {
            // P1
            assert.equal(await dist.getCurrentPeriodId(), 1);
            await dist.claimFunds(memberId1, { from: bob });

            await dist.disableMembers([memberId1], { from: verifier });
            await increaseTime(periodLength);

            let res = await dist.period(1);
            assert.equal(res.rewardPerMember, ether(75 * 1000));

            // P2
            assert.equal(await dist.getCurrentPeriodId(), 2);
            await dist.enableMembers([memberId1], { from: verifier });

            await assertRevert(
                dist.claimFunds(memberId1, { from: bob }),
               'One period should be skipped after re-enabling'
            );

            res = await dist.period(2);
            assert.equal(res.rewardPerMember, ether(112.5 * 1000));

            // but allow at P3
            await increaseTime(11 + periodLength);
            assert.equal(await dist.getCurrentPeriodId(), 3);
            await dist.claimFunds(memberId1, { from: bob });

            res = await dist.period(3);
            assert.equal(res.rewardPerMember, ether(75 * 1000));

            // and at P4
            await increaseTime(periodLength);
            assert.equal(await dist.getCurrentPeriodId(), 4);
            await dist.claimFunds(memberId1, { from: bob });

            res = await dist.period(4);
            assert.equal(res.rewardPerMember, ether(75 * 1000));
        });

        it('should deny me claiming a reward if disabled at P1 and enabled at P3', async function() {
            // P1
            assert.equal(await dist.getCurrentPeriodId(), 1);
            await dist.claimFunds(memberId1, { from: bob });

            await dist.disableMembers([memberId1], { from: verifier });

            let res = await dist.period(1);
            assert.equal(res.rewardPerMember, ether(75 * 1000));

            // is disabled at P2
            await increaseTime(periodLength);
            assert.equal(await dist.getCurrentPeriodId(), 2);

            await assertRevert(
                dist.claimFunds(memberId1, { from: bob }),
                'Not active member'
            );

            // period 2 reward was not distributed since no one had claimed it
            res = await dist.period(2);
            assert.equal(res.rewardPerMember, ether(0));

            // still deny at P3
            await increaseTime(periodLength);
            assert.equal(await dist.getCurrentPeriodId(), 3);
            // enable at P3
            await dist.enableMembers([memberId1], { from: verifier });

            await assertRevert(
                dist.claimFunds(memberId1, { from: bob }),
                'One period should be skipped after re-enabling'
            );

            res = await dist.period(3);
            assert.equal(res.rewardPerMember, ether(112.5 * 1000));

            // but allow at P4
            await increaseTime(periodLength);
            assert.equal(await dist.getCurrentPeriodId(), 4);
            await dist.claimFunds(memberId1, { from: bob });

            res = await dist.period(4);
            assert.equal(res.rewardPerMember, ether(75 * 1000));
        });
    })
});
