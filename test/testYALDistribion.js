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
});
