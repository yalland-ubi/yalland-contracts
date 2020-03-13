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

const { ether, now, increaseTime, assertRevert, zeroAddress, getResTimestamp } = require('@galtproject/solidity-test-chest')(web3);

const keccak256 = web3.utils.soliditySha3;

describe('YALDistributor Unit tests', () => {
    const [pauser, verifier, alice, bob, charlie, dan] = accounts;
    const deployer = defaultSender;

    // 7 days
    const periodLength = 7 * 24 * 60 * 60;
    const periodVolume = ether(250 * 1000);
    const verifierRewardShare = ether(10);
    const baseAliceBalance = 10000000;
    const feePercent = 0.02;
    const startAfter = 10;
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
    });

    describe('Verifier Interface', () => {
        beforeEach(async function() {
            await increaseTime(11);
            assert.equal(await dist.getCurrentPeriodId(), 0);
        });

        describe('#addMember()', () => {
            const memberId = keccak256('bob');

            it('should allow adding a member', async function() {
                const res = await dist.addMember(memberId, bob, { from: verifier });
                const addedAt = await getResTimestamp(res);

                assert.equal(await dist.memberAddress2Id(bob), memberId);

                const details = await dist.member(memberId);
                assert.equal(details.active, true);
                assert.equal(details.addr, bob);
                assert.equal(details.createdAt, addedAt);

                assert.equal(await dist.activeMemberCount(), 1);
            });

            it('should deny adding already existing member', async function() {
                await dist.addMember(memberId, bob, { from: verifier });
                await assertRevert(dist.addMember(memberId, bob, { from: verifier }), 'The address already registered');
            });

            it('should deny adding already existing member', async function() {
                await assertRevert(dist.addMember(memberId, bob, { from: alice }), 'Only verifier allowed');
            });
        });

        describe('#addMembers()', () => {
            const memberId1 = keccak256('bob');
            const memberId2 = keccak256('charlie');
            const memberId3 = keccak256('dan');

            it('should allow adding a single', async function() {
                const res = await dist.addMembers([memberId1], [bob], { from: verifier });
                const addedAt = await getResTimestamp(res);

                assert.equal(await dist.memberAddress2Id(bob), memberId1);

                const details = await dist.member(memberId1);
                assert.equal(details.active, true);
                assert.equal(details.addr, bob);
                assert.equal(details.createdAt, addedAt);

                assert.equal(await dist.activeMemberCount(), 1);
            });

            it('should allow adding multiple members', async function() {
                const res = await dist.addMembers([memberId1, memberId2, memberId3], [bob, charlie, dan], { from: verifier });
                const addedAt = await getResTimestamp(res);

                assert.equal(await dist.activeMemberCount(), 3);

                assert.equal(await dist.memberAddress2Id(bob), memberId1);
                assert.equal(await dist.memberAddress2Id(charlie), memberId2);
                assert.equal(await dist.memberAddress2Id(dan), memberId3);

                let details = await dist.member(memberId1);
                assert.equal(details.active, true);
                assert.equal(details.addr, bob);
                assert.equal(details.createdAt, addedAt);

                details = await dist.member(memberId2);
                assert.equal(details.active, true);
                assert.equal(details.addr, charlie);
                assert.equal(details.createdAt, addedAt);

                details = await dist.member(memberId3);
                assert.equal(details.active, true);
                assert.equal(details.addr, dan);
                assert.equal(details.createdAt, addedAt);
            });

            it('should deny adding 0 elements', async function() {
                await assertRevert(dist.addMembers([], [], { from: verifier }), "Missing");
            });

            it('should deny adding different amount of ids/addresses', async function() {
                await assertRevert(
                    dist.addMembers([memberId1, memberId2, memberId3], [bob, charlie], { from: verifier }),
                   'ID and address arrays length should match'
                );
            });

            it('should deny adding already existing member', async function() {
                await dist.addMember(memberId1, bob, { from: verifier });
                await assertRevert(
                    dist.addMembers([memberId1, memberId2], [bob, charlie], { from: verifier }),
                    'The address already registered'
                );
            });

            it('should deny non-owner calling the method', async function() {
                await assertRevert(
                    dist.addMembers([memberId1, memberId2], [bob, charlie], { from: alice }),
                    'Only verifier allowed'
                );
            });
        });
    });

    describe('Owner Interface', () => {
        describe('#setVerifier()', () => {
            it('should allow owner setting a new verifier', async function() {
                assert.equal(await dist.verifier(), verifier);
                await dist.setVerifier(bob);
                assert.equal(await dist.verifier(), bob);
            });

            it('should allow owner setting address(0) as a verifier', async function() {
                await dist.setVerifier(zeroAddress);
                assert.equal(await dist.verifier(), zeroAddress);
            });

            it('should deny non-owner setting a new verifier', async function() {
                await assertRevert(dist.setVerifier(bob, { from: alice }), 'Ownable: caller is not the owner');
            });
        });

        describe('#setVerifierRewardShare()', () => {
            it('should allow owner setting a new verifierRewardShare', async function() {
                assert.equal(await dist.verifierRewardShare(), ether(10));
                await dist.setVerifierRewardShare(ether(15));
                assert.equal(await dist.verifierRewardShare(), ether(15));
            });

            it('should allow owner setting a 0 verifierRewardShare', async function() {
                await dist.setVerifierRewardShare(ether(0));
                assert.equal(await dist.verifierRewardShare(), 0);
            });

            it('should deny owner setting a verifierRewardShare greater than 100%', async function() {
                await assertRevert(dist.setVerifierRewardShare(ether(100)), 'Can\'t be >= 100%');
                await assertRevert(dist.setVerifierRewardShare(ether(101)), 'Can\'t be >= 100%');
            });

            it('should deny non-owner setting a new verifierRewardShare', async function() {
                await assertRevert(dist.setVerifierRewardShare(ether(15), { from: alice }), 'Ownable: caller is not the owner');
            });
        });

        describe('#setPeriodVolume()', () => {
            it('should allow owner setting a new periodVolume', async function() {
                assert.equal(await dist.periodVolume(), ether(250 * 1000));
                await dist.setPeriodVolume(ether(123));
                assert.equal(await dist.periodVolume(), ether(123));
            });

            it('should allow owner setting a 0 periodVolume', async function() {
                await dist.setPeriodVolume(0);
                assert.equal(await dist.periodVolume(), 0);
            });

            it('should deny non-owner setting a new periodVolume', async function() {
                await assertRevert(dist.setPeriodVolume(ether(123), { from: alice }), 'Ownable: caller is not the owner');
            });
        });
    });
});
