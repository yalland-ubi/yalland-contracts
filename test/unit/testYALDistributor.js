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

const { ether, now, int, increaseTime, assertRevert, zeroAddress, getResTimestamp, assertErc20BalanceChanged } = require('@galtproject/solidity-test-chest')(web3);

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

    describe('Verifier Interface', () => {
        describe('#addMember()', () => {
            const memberId = keccak256('bob');

            it('should deny calling the method before genesis', async function() {
                await assertRevert(dist.addMember(memberId1, bob, { from: verifier }), ' Contract not initiated ye');
            });

            describe('after genesis', () => {
                beforeEach(async function() {
                    await increaseTime(11);
                    assert.equal(await dist.getCurrentPeriodId(), 0);
                });

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

                it('should deny adding already existing address', async function() {
                    await dist.addMember(memberId1, bob, { from: verifier });
                    await assertRevert(dist.addMember(memberId2, bob, { from: verifier }), 'The address already registered');
                });

                it('should deny adding already existing member', async function() {
                    await assertRevert(dist.addMember(memberId, bob, { from: alice }), 'Only verifier allowed');
                });
            })
        });

        describe('#addMembers()', () => {
            it('should deny calling the method before genesis', async function() {
                await assertRevert(dist.addMembers([memberId1], [bob], { from: verifier }), 'Contract not initiated yet');
            });

            describe('after genesis', () => {
                beforeEach(async function() {
                    await increaseTime(11);
                    assert.equal(await dist.getCurrentPeriodId(), 0);
                });

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

                it('should deny non-verifier calling the method', async function() {
                    await assertRevert(
                        dist.addMembers([memberId1, memberId2], [bob, charlie], { from: alice }),
                        'Only verifier allowed'
                    );
                });
            })
        });

        describe('#addMembersBeforeGenesis()', () => {
            it('should allow adding a single', async function() {
                const res = await dist.addMembersBeforeGenesis([memberId1], [bob], { from: verifier });
                const addedAt = await getResTimestamp(res);

                assert.equal(await dist.memberAddress2Id(bob), memberId1);

                const details = await dist.member(memberId1);
                assert.equal(details.active, true);
                assert.equal(details.addr, bob);
                assert.equal(details.createdAt, addedAt);

                assert.equal(await dist.activeMemberCount(), 1);
            });

            it('should allow adding multiple members', async function() {
                const res = await dist.addMembersBeforeGenesis([memberId1, memberId2, memberId3], [bob, charlie, dan], { from: verifier });
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
                await assertRevert(dist.addMembersBeforeGenesis([], [], { from: verifier }), "Missing");
            });

            it('should deny adding different amount of ids/addresses', async function() {
                await assertRevert(
                    dist.addMembersBeforeGenesis([memberId1, memberId2, memberId3], [bob, charlie], { from: verifier }),
                    'ID and address arrays length should match'
                );
            });

            it('should deny adding already existing member', async function() {
                await dist.addMembersBeforeGenesis([memberId1], [bob], { from: verifier });
                await assertRevert(
                    dist.addMembersBeforeGenesis([memberId1, memberId2], [bob, charlie], { from: verifier }),
                    'The address already registered'
                );
            });

            it('should deny non-verifier calling the method', async function() {
                await assertRevert(
                    dist.addMembersBeforeGenesis([memberId1, memberId2], [bob, charlie], { from: alice }),
                    'Only verifier allowed'
                );
            });

            it('should deny calling this method after genesis', async function() {
                await increaseTime(12);
                await assertRevert(
                    dist.addMembersBeforeGenesis([memberId1, memberId2], [bob, charlie], { from: verifier }),
                    'Can be called before genesis only'
                );
            });
        });

        describe('#disableMembers()', () => {
            beforeEach(async function() {
                await increaseTime(11);
                assert.equal(await dist.getCurrentPeriodId(), 0);
                await dist.addMember(memberId1, bob, { from: verifier });
                await dist.addMember(memberId2, charlie, { from: verifier });
                await dist.addMember(memberId3, dan, { from: verifier });
            });

            it('should allow disabling active member', async function() {
                const res = await dist.disableMembers([memberId1], { from: verifier });
                const disabledAt = await getResTimestamp(res);

                const details = await dist.member(memberId1);
                assert.equal(details.active, false);
                assert.equal(details.addr, bob);
                assert.equal(details.lastDisabledAt, disabledAt);
                assert.equal(details.lastEnabledAt, 0);
            });

            it('should decrement activeMemberCount for a single item', async function() {
                assert.equal(await dist.activeMemberCount(), 3);
                await dist.disableMembers([memberId1], { from: verifier });
                assert.equal(await dist.activeMemberCount(), 2);
            });

            it('should decrement activeMemberCount for multiple items', async function() {
                assert.equal(await dist.activeMemberCount(), 3);
                await dist.disableMembers([memberId1, memberId3, memberId2], { from: verifier });
                assert.equal(await dist.activeMemberCount(), 0);
            });

            it('should deny disabling if one of the members is inactive', async function() {
                await dist.disableMembers([memberId1], { from: verifier });
                await assertRevert(
                    dist.disableMembers([memberId1, memberId2, memberId3], { from: verifier }),
                    'One of the members is inactive'
                );
            });

            it('should deny non verifier disabling a member', async function() {
                await assertRevert(dist.disableMembers([memberId1], { from: alice }), 'Only verifier allowed');
            });

            it('should deny disabling an empty list', async function() {
                await assertRevert(dist.disableMembers([], { from: verifier }), 'Missing input members');
            });

            it('should deny disabling non existent member', async function() {
                await assertRevert(
                    dist.disableMembers([memberId4], { from: verifier }),
                    'One of the members is inactive'
                );
            });
        });

        describe('#enableMembers()', () => {
            beforeEach(async function() {
                await increaseTime(11);
                assert.equal(await dist.getCurrentPeriodId(), 0);
                await dist.addMember(memberId1, bob, { from: verifier });
                await dist.addMember(memberId2, charlie, { from: verifier });
                await dist.addMember(memberId3, dan, { from: verifier });
                await dist.disableMembers([memberId1, memberId3, memberId2], { from: verifier });
            });

            it('should allow enabled inactive member', async function() {
                const res = await dist.enableMembers([memberId1], { from: verifier });
                const enabledAt = await getResTimestamp(res);

                const details = await dist.member(memberId1);
                assert.equal(details.active, true);
                assert.equal(details.addr, bob);
                assert.equal(details.lastEnabledAt, enabledAt);
            });

            it('should increment activeMemberCount for a single item', async function() {
                assert.equal(await dist.activeMemberCount(), 0);
                await dist.enableMembers([memberId1], { from: verifier });
                assert.equal(await dist.activeMemberCount(), 1);
            });

            it('should decrement activeMemberCount for multiple items', async function() {
                assert.equal(await dist.activeMemberCount(), 0);
                await dist.enableMembers([memberId1, memberId3, memberId2], { from: verifier });
                assert.equal(await dist.activeMemberCount(), 3);
            });

            it('should deny enabling if one of the members is active', async function() {
                await dist.enableMembers([memberId1], { from: verifier });
                await assertRevert(
                    dist.enableMembers([memberId1, memberId2, memberId3], { from: verifier }),
                    'One of the members is active'
                );
            });

            it('should deny non verifier enabling a member', async function() {
                await assertRevert(dist.enableMembers([memberId1], { from: alice }), 'Only verifier allowed');
            });

            it('should deny enabling an empty list', async function() {
                await assertRevert(dist.enableMembers([], { from: verifier }), 'Missing input members');
            });

            it('should deny enabling non existent member', async function() {
                await assertRevert(
                    dist.enableMembers([memberId4], { from: verifier }),
                    'Member doesn\'t exist'
                );
            });
        });

        describe('#changeMemberAddress()', () => {
            beforeEach(async function() {
                await increaseTime(11);
                assert.equal(await dist.getCurrentPeriodId(), 0);
                await dist.addMember(memberId1, bob, { from: verifier });
            });

            it('should allow changing address for an active member', async function() {
                assert.equal(await dist.memberAddress2Id(bob), memberId1);
                assert.equal(await dist.memberAddress2Id(alice), '0x0000000000000000000000000000000000000000000000000000000000000000');

                const res = await dist.changeMemberAddress(memberId1, alice, { from: verifier });

                const details = await dist.member(memberId1);
                assert.equal(details.active, true);
                assert.equal(details.addr, alice);

                assert.equal(await dist.memberAddress2Id(alice), memberId1);
                assert.equal(await dist.memberAddress2Id(bob), '0x0000000000000000000000000000000000000000000000000000000000000000');
            });

            it('should allow changing address for an inactive member', async function() {
                await dist.disableMembers([memberId1], { from: verifier });
                await dist.changeMemberAddress(memberId1, alice, { from: verifier });

                const details = await dist.member(memberId1);
                assert.equal(details.active, false);
                assert.equal(details.addr, alice);
            });

            it('should deny non verifier changing a member address', async function() {
                await assertRevert(dist.changeMemberAddress(memberId1, alice, { from: alice }), 'Only verifier allowed');
            });

            it('should deny changing a non-existent member address', async function() {
                await assertRevert(dist.changeMemberAddress(memberId4, alice, { from: verifier }), ' Member doesn\'t exist');
            });
        });

        describe('#claimVerifierReward', () => {
            it('should allow verifier claiming reward', async function() {
                await dist.addMembersBeforeGenesis([memberId1], [bob], { from: verifier });

                await increaseTime(11);

                // P0
                assert.equal(await dist.getCurrentPeriodId(), 0);

                const charlieBalanceBefore = await coinToken.balanceOf(charlie);
                await dist.claimVerifierReward(0, charlie, { from: verifier });
                const charlieBalanceAfter = await coinToken.balanceOf(charlie);

                let res = await dist.period(0);
                assert.equal(res.verifierReward, ether(25 * 1000));

                assertErc20BalanceChanged(charlieBalanceBefore, charlieBalanceAfter, ether(25 * 1000))
            });

            it('should deny verifier claiming reward twice', async function() {
                await dist.addMembersBeforeGenesis([memberId1], [bob], { from: verifier });
                await increaseTime(11);

                // P0
                assert.equal(await dist.getCurrentPeriodId(), 0);
                await dist.claimVerifierReward(0, charlie, { from: verifier });
                await assertRevert(dist.claimVerifierReward(0, charlie, { from: verifier }));
            });

            it('should not assign P0 verifier reward if there were no users at genesisTimestamp', async function() {
                await increaseTime(11);

                // P0
                assert.equal(await dist.getCurrentPeriodId(), 0);

                await dist.addMember(memberId1, bob, { from: verifier });

                let res = await dist.period(0);
                assert.equal(res.verifierReward, 0);

                await dist.claimVerifierReward(0, charlie, { from: verifier });
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

    describe('Member Interface', () => {
        describe('#changeMyAddress()', () => {
            beforeEach(async function() {
                await increaseTime(11);
                assert.equal(await dist.getCurrentPeriodId(), 0);
                await dist.addMember(memberId1, bob, { from: verifier });
            });

            it('should allow an active member changing his address', async function() {
                assert.equal(await dist.memberAddress2Id(bob), memberId1);
                assert.equal(await dist.memberAddress2Id(alice), '0x0000000000000000000000000000000000000000000000000000000000000000');

                await dist.changeMyAddress(memberId1, alice, { from: bob });

                const details = await dist.member(memberId1);
                assert.equal(details.active, true);
                assert.equal(details.addr, alice);

                assert.equal(await dist.memberAddress2Id(alice), memberId1);
                assert.equal(await dist.memberAddress2Id(bob), '0x0000000000000000000000000000000000000000000000000000000000000000');
            });

            it('should allow inactive member changing his address', async function() {
                await dist.disableMembers([memberId1], { from: verifier });
                const res = await dist.changeMyAddress(memberId1, alice, { from: bob });

                const details = await dist.member(memberId1);
                assert.equal(details.active, false);
                assert.equal(details.addr, alice);
            });

            it('should deny non member changing the member address', async function() {
                await assertRevert(dist.changeMyAddress(memberId1, alice, { from: verifier }), 'Only the member allowed');
            });
        });
    })

    describe('View Methods', () => {
        describe('#getCurrentPeriodId()', async function() {
            it('should revert before genesisTimestamp', async function() {
                await increaseTime(5);
                await assertRevert(dist.getCurrentPeriodId(), 'Contract not initiated yet');
            });

            it('should return 0 period on genesisTimestamp + 0.5 * periodLength', async function() {
                await increaseTime(10 + periodLength *  0.5);
                assert.equal(await dist.getCurrentPeriodId(), 0);
            });

            it('should return 2 period on genesisTimestamp + 2.5 * periodLength', async function() {
                await increaseTime(10 + periodLength * 2.5);
                assert.equal(await dist.getCurrentPeriodId(), 2);
            });
        });

        describe('#currentPeriodBeginsAt()/#getNextPeriodBeginsAt()/#getPreviousPeriodBeginsAt()', async function() {
            it('should return correct time genesisTimestamp', async function() {
                await increaseTime(8);
                await assertRevert(dist.getPreviousPeriodBeginsAt(), 'Contract not initiated yet');
                await assertRevert(dist.getCurrentPeriodBeginsAt(), 'Contract not initiated yet');
                await assertRevert(dist.getNextPeriodBeginsAt(), 'Contract not initiated yet');
            });

            it('should return correct time on P1', async function() {
                await increaseTime(11);
                await assertRevert(dist.getPreviousPeriodBeginsAt(), 'No previous period');
                assert.equal(
                    await dist.getCurrentPeriodBeginsAt(),
                    await dist.genesisTimestamp()
                );
                assert.equal(
                    await dist.getNextPeriodBeginsAt(),
                    (int(await dist.genesisTimestamp()) + int(await dist.periodLength()))
                );
            });

            it('should return correct time before 0->1 transition', async function() {
                await increaseTime(10 + periodLength - 2);
                await assertRevert(dist.getPreviousPeriodBeginsAt(), 'No previous period');
                assert.equal(
                    await dist.getCurrentPeriodBeginsAt(),
                    await dist.genesisTimestamp()
                );
                assert.equal(
                    await dist.getNextPeriodBeginsAt(),
                    (int(await dist.genesisTimestamp()) + int(await dist.periodLength()))
                );
            });

            it('should return correct time after 0->1 transition', async function() {
                await increaseTime(11 + periodLength);
                assert.equal(
                    await dist.getPreviousPeriodBeginsAt(),
                    await dist.genesisTimestamp()
                );
                assert.equal(
                    await dist.getCurrentPeriodBeginsAt(),
                    int(await dist.genesisTimestamp()) + int(await dist.periodLength())
                );
                assert.equal(
                    await dist.getNextPeriodBeginsAt(),
                    (int(await dist.genesisTimestamp()) + 2 *int(await dist.periodLength()))
                );
            });

            it('should return correct time before 1->2 transition', async function() {
                await increaseTime(10 + periodLength * 2 - 2);
                assert.equal(
                    await dist.getPreviousPeriodBeginsAt(),
                    await dist.genesisTimestamp()
                );
                assert.equal(
                    await dist.getCurrentPeriodBeginsAt(),
                    int(await dist.genesisTimestamp()) + int(await dist.periodLength())
                );
                assert.equal(
                    await dist.getNextPeriodBeginsAt(),
                    (int(await dist.genesisTimestamp()) + 2 *int(await dist.periodLength()))
                );
            });
        });
    })
});
