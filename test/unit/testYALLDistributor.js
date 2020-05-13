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
const {
    deployRelayHub,
    fundRecipient,
} = require('@openzeppelin/gsn-helpers');
const { buildCoinDistAndExchange } = require('../builders');

const YALLToken = contract.fromArtifact('YALLToken');
const YALLDistributor = contract.fromArtifact('YALLDistributor');
const { approveFunction, assertRelayedCall, GSNRecipientSignatureErrorCodes } = require('../helpers')(web3);

YALLToken.numberFormat = 'String';
YALLDistributor.numberFormat = 'String';

const { ether, now, int, increaseTime, assertRevert, assertGsnReject, zeroAddress, getResTimestamp, assertErc20BalanceChanged } = require('@galtproject/solidity-test-chest')(web3);

const keccak256 = web3.utils.soliditySha3;

describe('YALLDistributor Unit tests', () => {
    const [distributorVerifier, distributorManager, alice, bob, charlie, dan, eve, yallMinter, yallBurner, feeManager, feeClaimer, yallWLManager, pauser, distributorEmissionClaimer] = accounts;

    // 7 days
    const periodLength = 7 * 24 * 60 * 60;
    const periodVolume = ether(250 * 1000);
    const emissionPoolRewardShare = ether(10);
    const baseAliceBalance = 10000000;
    const feePercent = 0.02;
    const startAfter = 10;
    const memberId1 = keccak256('bob');
    const memberId2 = keccak256('charlie');
    const memberId3 = keccak256('dan');
    const memberId4 = keccak256('eve');
    let genesisTimestamp;
    let yallToken;
    let dist;

    beforeEach(async function () {
        ({ registry, yallToken, dist, genesisTimestamp } = await buildCoinDistAndExchange(web3, defaultSender, {
            periodVolume,
            pauser,
            feeManager,
            feeClaimer,
            distributorManager,
            distributorVerifier,
            distributorEmissionClaimer,
            yallMinter,
            yallBurner,
            yallWLManager
        }));

        await yallToken.mint(alice, ether(baseAliceBalance), { from: yallMinter });
        await yallToken.setTransferFee(ether('0.02'), { from: feeManager });
        await yallToken.setGsnFee(ether('1.7'), { from: feeManager });

        await dist.setGsnFee(ether('4.2'), { from: feeManager });

        // this will affect on dist provider too
        yallToken.contract.currentProvider.wrappedProvider.relayClient.approveFunction = approveFunction;

        await deployRelayHub(web3);
        await fundRecipient(web3, { recipient: dist.address, amount: ether(1) });
    });

    describe('DistributorVerifier Interface', () => {
        describe('#addMember()', () => {
            const memberId = keccak256('bob');

            it('should deny calling the method before genesis', async function() {
                await assertRevert(dist.addMember(memberId1, bob, { from: distributorVerifier }), ' Contract not initiated ye');
            });

            describe('after genesis', () => {
                beforeEach(async function() {
                    await increaseTime(11);
                    assert.equal(await dist.getCurrentPeriodId(), 0);
                });

                it('should allow adding a member', async function() {
                    const res = await dist.addMember(memberId, bob, { from: distributorVerifier });
                    const addedAt = await getResTimestamp(res);

                    assert.equal(await dist.memberAddress2Id(bob), memberId);

                    const details = await dist.member(memberId);
                    assert.equal(details.active, true);
                    assert.equal(details.addr, bob);
                    assert.equal(details.createdAt, addedAt);

                    assert.equal(await dist.activeMemberCount(), 1);
                });

                it('should deny adding already existing member', async function() {
                    await dist.addMember(memberId, bob, { from: distributorVerifier });
                    await assertRevert(dist.addMember(memberId, bob, { from: distributorVerifier }), 'The address already registered');
                });

                it('should deny adding already existing address', async function() {
                    await dist.addMember(memberId1, bob, { from: distributorVerifier });
                    await assertRevert(dist.addMember(memberId2, bob, { from: distributorVerifier }), 'The address already registered');
                });

                it('should deny adding already existing member', async function() {
                    await assertRevert(dist.addMember(memberId, bob, { from: alice }), 'YALLDistributor: Only DISTRIBUTOR_VERIFIER allowed');
                });
            })
        });

        describe('#addMembers()', () => {
            it('should deny calling the method before genesis', async function() {
                await assertRevert(dist.addMembers([memberId1], [bob], { from: distributorVerifier }), 'Contract not initiated yet');
            });

            describe('after genesis', () => {
                beforeEach(async function() {
                    await increaseTime(11);
                    assert.equal(await dist.getCurrentPeriodId(), 0);
                });

                it('should allow adding a single', async function() {
                    const res = await dist.addMembers([memberId1], [bob], { from: distributorVerifier });
                    const addedAt = await getResTimestamp(res);

                    assert.equal(await dist.memberAddress2Id(bob), memberId1);

                    const details = await dist.member(memberId1);
                    assert.equal(details.active, true);
                    assert.equal(details.addr, bob);
                    assert.equal(details.createdAt, addedAt);

                    assert.equal(await dist.activeMemberCount(), 1);
                });

                it('should allow adding multiple members', async function() {
                    const res = await dist.addMembers([memberId1, memberId2, memberId3], [bob, charlie, dan], { from: distributorVerifier });
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
                    await assertRevert(dist.addMembers([], [], { from: distributorVerifier }), "Missing");
                });

                it('should deny adding different amount of ids/addresses', async function() {
                    await assertRevert(
                        dist.addMembers([memberId1, memberId2, memberId3], [bob, charlie], { from: distributorVerifier }),
                        'ID and address arrays length should match'
                    );
                });

                it('should deny adding already existing member', async function() {
                    await dist.addMember(memberId1, bob, { from: distributorVerifier });
                    await assertRevert(
                        dist.addMembers([memberId1, memberId2], [bob, charlie], { from: distributorVerifier }),
                        'The address already registered'
                    );
                });

                it('should deny non-distributorVerifier calling the method', async function() {
                    await assertRevert(
                        dist.addMembers([memberId1, memberId2], [bob, charlie], { from: alice }),
                        'YALLDistributor: Only DISTRIBUTOR_VERIFIER allowed'
                    );
                });
            })
        });

        describe('#addMembersBeforeGenesis()', () => {
            it('should allow adding a single', async function() {
                const res = await dist.addMembersBeforeGenesis([memberId1], [bob], { from: distributorVerifier });
                const addedAt = await getResTimestamp(res);

                assert.equal(await dist.memberAddress2Id(bob), memberId1);

                const details = await dist.member(memberId1);
                assert.equal(details.active, true);
                assert.equal(details.addr, bob);
                assert.equal(details.createdAt, addedAt);

                assert.equal(await dist.activeMemberCount(), 1);
            });

            it('should allow adding multiple members', async function() {
                const res = await dist.addMembersBeforeGenesis([memberId1, memberId2, memberId3], [bob, charlie, dan], { from: distributorVerifier });
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
                await assertRevert(dist.addMembersBeforeGenesis([], [], { from: distributorVerifier }), "Missing");
            });

            it('should deny adding different amount of ids/addresses', async function() {
                await assertRevert(
                    dist.addMembersBeforeGenesis([memberId1, memberId2, memberId3], [bob, charlie], { from: distributorVerifier }),
                    'ID and address arrays length should match'
                );
            });

            it('should deny adding already existing member', async function() {
                await dist.addMembersBeforeGenesis([memberId1], [bob], { from: distributorVerifier });
                await assertRevert(
                    dist.addMembersBeforeGenesis([memberId1, memberId2], [bob, charlie], { from: distributorVerifier }),
                    'The address already registered'
                );
            });

            it('should deny non-distributorVerifier calling the method', async function() {
                await assertRevert(
                    dist.addMembersBeforeGenesis([memberId1, memberId2], [bob, charlie], { from: alice }),
                    'YALLDistributor: Only DISTRIBUTOR_VERIFIER allowed'
                );
            });

            it('should deny calling this method after genesis', async function() {
                await increaseTime(12);
                await assertRevert(
                    dist.addMembersBeforeGenesis([memberId1, memberId2], [bob, charlie], { from: distributorVerifier }),
                    'Can be called before genesis only'
                );
            });
        });

        describe('#disableMembers()', () => {
            beforeEach(async function() {
                await increaseTime(11);
                assert.equal(await dist.getCurrentPeriodId(), 0);
                await dist.addMember(memberId1, bob, { from: distributorVerifier });
                await dist.addMember(memberId2, charlie, { from: distributorVerifier });
                await dist.addMember(memberId3, dan, { from: distributorVerifier });
            });

            it('should allow disabling active member', async function() {
                const res = await dist.disableMembers([bob], { from: distributorVerifier });
                const disabledAt = await getResTimestamp(res);

                const details = await dist.member(memberId1);
                assert.equal(details.active, false);
                assert.equal(details.addr, bob);
                assert.equal(details.lastDisabledAt, disabledAt);
                assert.equal(details.lastEnabledAt, 0);
            });

            it('should decrement activeMemberCount for a single item', async function() {
                assert.equal(await dist.activeMemberCount(), 3);
                await dist.disableMembers([bob], { from: distributorVerifier });
                assert.equal(await dist.activeMemberCount(), 2);
            });

            it('should decrement activeMemberCount for multiple items', async function() {
                assert.equal(await dist.activeMemberCount(), 3);
                await dist.disableMembers([bob, charlie, dan], { from: distributorVerifier });
                assert.equal(await dist.activeMemberCount(), 0);
            });

            it('should deny disabling if one of the members is inactive', async function() {
                await dist.disableMembers([bob], { from: distributorVerifier });
                await assertRevert(
                    dist.disableMembers([bob, charlie, dan], { from: distributorVerifier }),
                    'One of the members is inactive'
                );
            });

            it('should deny non distributorVerifier disabling a member', async function() {
                await assertRevert(dist.disableMembers([bob], { from: alice }), 'YALLDistributor: Only DISTRIBUTOR_VERIFIER allowed');
            });

            it('should deny disabling an empty list', async function() {
                await assertRevert(dist.disableMembers([], { from: distributorVerifier }), 'Missing input members');
            });

            it('should deny disabling non existent member', async function() {
                await assertRevert(
                    dist.disableMembers([alice], { from: distributorVerifier }),
                    'One of the members is inactive'
                );
            });
        });

        describe('#enableMembers()', () => {
            beforeEach(async function() {
                await increaseTime(11);
                assert.equal(await dist.getCurrentPeriodId(), 0);
                await dist.addMember(memberId1, bob, { from: distributorVerifier });
                await dist.addMember(memberId2, charlie, { from: distributorVerifier });
                await dist.addMember(memberId3, dan, { from: distributorVerifier });
                await dist.disableMembers([bob, charlie, dan], { from: distributorVerifier });
            });

            it('should allow enabled inactive member', async function() {
                const res = await dist.enableMembers([bob], { from: distributorVerifier });
                const enabledAt = await getResTimestamp(res);

                const details = await dist.member(memberId1);
                assert.equal(details.active, true);
                assert.equal(details.addr, bob);
                assert.equal(details.lastEnabledAt, enabledAt);
            });

            it('should increment activeMemberCount for a single item', async function() {
                assert.equal(await dist.activeMemberCount(), 0);
                await dist.enableMembers([bob], { from: distributorVerifier });
                assert.equal(await dist.activeMemberCount(), 1);
            });

            it('should decrement activeMemberCount for multiple items', async function() {
                assert.equal(await dist.activeMemberCount(), 0);
                await dist.enableMembers([bob, charlie, dan], { from: distributorVerifier });
                assert.equal(await dist.activeMemberCount(), 3);
            });

            it('should deny enabling if one of the members is active', async function() {
                await dist.enableMembers([bob], { from: distributorVerifier });
                await assertRevert(
                    dist.enableMembers([bob, charlie, dan], { from: distributorVerifier }),
                    'One of the members is active'
                );
            });

            it('should deny non distributorVerifier enabling a member', async function() {
                await assertRevert(dist.enableMembers([bob], { from: alice }), 'YALLDistributor: Only DISTRIBUTOR_VERIFIER allowed');
            });

            it('should deny enabling an empty list', async function() {
                await assertRevert(dist.enableMembers([], { from: distributorVerifier }), 'Missing input members');
            });

            it('should deny enabling non existent member', async function() {
                await assertRevert(
                    dist.enableMembers([alice], { from: distributorVerifier }),
                    'Member doesn\'t exist'
                );
            });
        });

        describe('#changeMemberAddress()', () => {
            beforeEach(async function() {
                await increaseTime(11);
                assert.equal(await dist.getCurrentPeriodId(), 0);
                await dist.addMember(memberId1, bob, { from: distributorVerifier });
                await dist.addMember(memberId2, charlie, { from: distributorVerifier });
            });

            it('should allow changing address for an active member', async function() {
                assert.equal(await dist.memberAddress2Id(bob), memberId1);
                assert.equal(
                    await dist.memberAddress2Id(alice),
                    '0x0000000000000000000000000000000000000000000000000000000000000000'
                );

                const res = await dist.changeMemberAddress(bob, alice, { from: distributorVerifier });

                const details = await dist.member(memberId1);
                assert.equal(details.active, true);
                assert.equal(details.addr, alice);

                assert.equal(await dist.memberAddress2Id(alice), memberId1);
                assert.equal(
                    await dist.memberAddress2Id(bob),
                    '0x0000000000000000000000000000000000000000000000000000000000000000'
                );
            });

            it('should allow changing address for an inactive member', async function() {
                await dist.disableMembers([bob], { from: distributorVerifier });
                await dist.changeMemberAddress(bob, alice, { from: distributorVerifier });

                const details = await dist.member(memberId1);
                assert.equal(details.active, false);
                assert.equal(details.addr, alice);
            });

            it('should deny non distributorVerifier changing a member address', async function() {
                await assertRevert(dist.changeMemberAddress(bob, alice, { from: alice }), 'YALLDistributor: Only DISTRIBUTOR_VERIFIER allowed');
            });

            it('should deny changing a non-existent member address', async function() {
                await assertRevert(dist.changeMemberAddress(dan, alice, { from: distributorVerifier }), 'Member doesn\'t exist');
            });

            it('should deny changing to an already occupied address', async function() {
                await assertRevert(
                    dist.changeMemberAddress(bob, charlie, { from: distributorVerifier }),
                    'Address is already taken by another member'
                );
            });
        });

        describe('#changeMemberAddresses()', () => {
            beforeEach(async function() {
                await increaseTime(11);
                assert.equal(await dist.getCurrentPeriodId(), 0);
                await dist.addMember(memberId1, bob, { from: distributorVerifier });
                await dist.addMember(memberId2, charlie, { from: distributorVerifier });
                await dist.addMember(memberId3, dan, { from: distributorVerifier });
            });

            it('should allow changing address for an active member', async function() {
                assert.equal(await dist.memberAddress2Id(dan), memberId3);
                assert.equal(await dist.memberAddress2Id(bob), memberId1);
                assert.equal(
                    await dist.memberAddress2Id(alice),
                    '0x0000000000000000000000000000000000000000000000000000000000000000'
                );

                // bob => alice && dan => bob
                await dist.changeMemberAddresses([bob, dan], [alice, bob], { from: distributorVerifier });

                let details = await dist.member(memberId1);
                assert.equal(details.active, true);
                assert.equal(details.addr, alice);

                details = await dist.member(memberId3);
                assert.equal(details.active, true);
                assert.equal(details.addr, bob);

                assert.equal(await dist.memberAddress2Id(alice), memberId1);
                assert.equal(await dist.memberAddress2Id(bob), memberId3);
                assert.equal(
                    await dist.memberAddress2Id(dan),
                    '0x0000000000000000000000000000000000000000000000000000000000000000'
                );
            });

            it('should allow changing address for an inactive member', async function() {
                await dist.disableMembers([bob], { from: distributorVerifier });
                await dist.changeMemberAddresses([bob, charlie], [alice, bob], { from: distributorVerifier });

                const details = await dist.member(memberId1);
                assert.equal(details.active, false);
                assert.equal(details.addr, alice);
            });

            it('should deny non distributorVerifier changing a member address', async function() {
                await assertRevert(
                    dist.changeMemberAddresses([bob], [alice], { from: alice }),
                    'YALLDistributor: Only DISTRIBUTOR_VERIFIER allowed'
                );
            });

            it('should deny changing a non-existent member address', async function() {
                await assertRevert(
                    dist.changeMemberAddresses([eve, dan], [alice, alice], { from: distributorVerifier }),
                    'Member doesn\'t exist'
                );
            });

            it('should deny changing to an already occupied address', async function() {
                await assertRevert(
                    dist.changeMemberAddresses([bob], [charlie], { from: distributorVerifier }),
                    'Address is already taken by another member'
                );
            });
        });
    });

    describe('DistributorEmissionClaimer Interface', () => {
        describe('#claimEmissionPoolReward', () => {
            it('should allow distributorEmissionClaimer claiming reward', async function() {
                await dist.addMembersBeforeGenesis([memberId1], [bob], { from: distributorVerifier });

                await increaseTime(11);

                // P0
                assert.equal(await dist.getCurrentPeriodId(), 0);

                const charlieBalanceBefore = await yallToken.balanceOf(charlie);
                await dist.distributeEmissionPoolReward(0, charlie, ether(25 * 1000), { from: distributorEmissionClaimer });
                const charlieBalanceAfter = await yallToken.balanceOf(charlie);

                let res = await dist.period(0);
                assert.equal(res.emissionPoolRewardTotal, ether(25 * 1000));

                assertErc20BalanceChanged(charlieBalanceBefore, charlieBalanceAfter, ether(25 * 1000))
            });

            it('should deny distributorEmissionClaimer claiming more reward than distributed', async function() {
                await dist.addMembersBeforeGenesis([memberId1], [bob], { from: distributorVerifier });
                await increaseTime(11);

                // P0
                assert.equal(await dist.getCurrentPeriodId(), 0);
                await dist.distributeEmissionPoolReward(0, charlie, ether(15 * 1000), { from: distributorEmissionClaimer });
                await dist.distributeEmissionPoolReward(0, bob, ether(5 * 1000), { from: distributorEmissionClaimer });
                await assertRevert(
                    dist.distributeEmissionPoolReward(0, charlie, ether(6 * 1000), { from: distributorEmissionClaimer }),
                    'YALLDistributor: Exceeds the period emission reward'
                );
                await dist.distributeEmissionPoolReward(0, bob, ether(5 * 1000), { from: distributorEmissionClaimer });
            });

            it('should not assign P0 distributorEmissionClaimer reward if there were no users at genesisTimestamp', async function() {
                await increaseTime(11);

                // P0
                assert.equal(await dist.getCurrentPeriodId(), 0);

                await dist.addMember(memberId1, bob, { from: distributorVerifier });

                let res = await dist.period(0);
                assert.equal(res.emissionPoolRewardTotal, 0);

                await dist.distributeEmissionPoolReward(0, charlie, ether(25 * 1000), { from: distributorEmissionClaimer });
            });

            it('should deny non-distributorEmissionClaimer claiming reward', async function() {
                await dist.addMembersBeforeGenesis([memberId1], [bob], { from: distributorVerifier });

                await increaseTime(11);

                // P0
                assert.equal(await dist.getCurrentPeriodId(), 0);
                await assertRevert(
                    dist.distributeEmissionPoolReward(0, charlie, ether(25 * 1000), { from: distributorVerifier }),
                    'YALLDistributor: Only DISTRIBUTOR_EMISSION_CLAIMER allowed'
                );
            });
        });
    });

    describe('DistributorManager Interface', () => {
        describe('#setEmissionPoolRewardShare()', () => {
            it('should allow owner setting a new emissionPoolRewardShare', async function() {
                assert.equal(await dist.emissionPoolRewardShare(), ether(10));
                await dist.setEmissionPoolRewardShare(ether(15), { from: distributorManager });
                assert.equal(await dist.emissionPoolRewardShare(), ether(15));
            });

            it('should allow distributorManager setting a 0 emissionPoolRewardShare', async function() {
                await dist.setEmissionPoolRewardShare(ether(0), { from: distributorManager });
                assert.equal(await dist.emissionPoolRewardShare(), 0);
            });

            it('should deny distributorManager setting a emissionPoolRewardShare greater than 100%', async function() {
                await assertRevert(dist.setEmissionPoolRewardShare(ether(100), { from: distributorManager }), 'Can\'t be >= 100%');
                await assertRevert(dist.setEmissionPoolRewardShare(ether(101), { from: distributorManager }), 'Can\'t be >= 100%');
            });

            it('should deny non-distributorManager setting a new emissionPoolRewardShare', async function() {
                await assertRevert(dist.setEmissionPoolRewardShare(ether(15), { from: alice }), 'YALLDistributor: Only DISTRIBUTOR_MANAGER allowed');
            });
        });

        describe('#setPeriodVolume()', () => {
            it('should allow distributorManager setting a new periodVolume', async function() {
                assert.equal(await dist.periodVolume(), ether(250 * 1000));
                await dist.setPeriodVolume(ether(123), { from: distributorManager });
                assert.equal(await dist.periodVolume(), ether(123));
            });

            it('should allow distributorManager setting a 0 periodVolume', async function() {
                await dist.setPeriodVolume(0, { from: distributorManager });
                assert.equal(await dist.periodVolume(), 0);
            });

            it('should deny non-distributorManager setting a new periodVolume', async function() {
                await assertRevert(dist.setPeriodVolume(ether(123), { from: alice }), 'YALLDistributor: Only DISTRIBUTOR_MANAGER allowed');
            });
        });
    });

    describe('FeeClaimer Interface', () => {
        describe('#withdrawFee()', () => {
            beforeEach(async function() {
                await increaseTime(11);
                await dist.addMembers([keccak256('bob')], [bob], { from: distributorVerifier })
                await yallToken.setWhitelistAddress(dist.address, true, { from: yallWLManager });
                await yallToken.setWhitelistAddress(feeClaimer, true, { from: yallWLManager });
                await dist.changeMyAddress(alice, { from: bob });

                await yallToken.transfer(dist.address, ether(42), { from: alice })
            })

            it('should allow feeClaimer withdrawing fee', async function() {
                assert.equal(await yallToken.balanceOf(feeClaimer), 0);
                await dist.withdrawFee({ from: feeClaimer });
                assert.equal(await yallToken.balanceOf(feeClaimer), ether('41.98'));
            });

            it('should deny non-feeClaimer withdrawing fee', async function() {
                await assertRevert(dist.withdrawFee({ from: alice }), 'YALLHelpers: Only FEE_CLAIMER allowed');
            });
        });

    });

    describe('Pauser Interface', () => {
        describe('#pause()/#unpause()', () => {
            it('should allow the pauser pausing/unpausing contract', async function() {
                assert.equal(await dist.paused(), false);
                await dist.pause({ from: pauser });
                assert.equal(await dist.paused(), true);
                await dist.unpause({ from: pauser });
                assert.equal(await dist.paused(), false);
            });

            it('should deny non-pauser pausing/unpausing contract', async function() {
                await assertRevert(dist.pause({ from: distributorVerifier }), 'YALLHelpers: Only PAUSER allowed');
                await assertRevert(dist.unpause({ from: distributorVerifier }), 'YALLHelpers: Only PAUSER allowed');
            });
        });
    });

    describe('Member Interface', () => {
        describe('#changeMyAddress()', () => {
            beforeEach(async function() {
                await increaseTime(11);
                assert.equal(await dist.getCurrentPeriodId(), 0);
                await dist.addMember(memberId1, bob, { from: distributorVerifier });
                await dist.addMember(memberId2, charlie, { from: distributorVerifier });
            });

            it('should allow an active member changing his address', async function() {
                assert.equal(await dist.memberAddress2Id(bob), memberId1);
                assert.equal(
                    await dist.memberAddress2Id(alice),
                    '0x0000000000000000000000000000000000000000000000000000000000000000'
                );

                await yallToken.burn(alice, ether(baseAliceBalance), { from: yallBurner });
                assert.equal(await yallToken.balanceOf(alice), ether(0));
                assert.equal(await yallToken.balanceOf(bob), ether(0));

                await dist.changeMyAddress(alice, { from: bob });

                assert.equal(await yallToken.balanceOf(alice), ether(0));
                assert.equal(await yallToken.balanceOf(bob), ether(0));

                const details = await dist.member(memberId1);
                assert.equal(details.active, true);
                assert.equal(details.addr, alice);

                assert.equal(await dist.memberAddress2Id(alice), memberId1);
                assert.equal(
                    await dist.memberAddress2Id(bob),
                    '0x0000000000000000000000000000000000000000000000000000000000000000'
                );
            });

            it('should allow an active member changing his address using GSN', async function() {
                assert.equal(await dist.memberAddress2Id(bob), memberId1);
                assert.equal(
                    await dist.memberAddress2Id(alice),
                    '0x0000000000000000000000000000000000000000000000000000000000000000'
                );

                await yallToken.setWhitelistAddress(dist.address, true, { from: yallWLManager });

                await yallToken.mint(dist.address, ether(12), { from: yallMinter });
                await yallToken.mint(bob, ether(12), { from: yallMinter });
                await yallToken.mint(charlie, ether(12), { from: yallMinter });
                await yallToken.transfer(charlie, ether(1), { from: charlie });

                assert.equal(await yallToken.balanceOf(alice), ether(baseAliceBalance));
                assert.equal(await yallToken.balanceOf(bob), ether(12));

                await yallToken.approve(dist.address, await ether(4.2), { from: bob });
                const res = await dist.changeMyAddress(alice, { from: bob, gasLimit: 9000000, useGSN: true });
                assertRelayedCall(res);

                assert.equal(await yallToken.balanceOf(alice), ether(baseAliceBalance + 12 - 4.2));
                assert.equal(await yallToken.balanceOf(bob), ether(0));

                const details = await dist.member(memberId1);
                assert.equal(details.active, true);
                assert.equal(details.addr, alice);

                assert.equal(await dist.memberAddress2Id(alice), memberId1);
                assert.equal(
                    await dist.memberAddress2Id(bob),
                    '0x0000000000000000000000000000000000000000000000000000000000000000'
                );
            });

            describe('GSN reject', () => {
                beforeEach(async function() {
                    await yallToken.mint(bob, ether(12), { from: yallMinter });
                    assert.equal(await yallToken.balanceOf(alice), ether(baseAliceBalance));
                    assert.equal(await yallToken.balanceOf(bob), ether(12));
                    assert.equal(await dist.gsnFee(), ether('4.2'));
                    await yallToken.setWhitelistAddress(dist.address, true, { from: yallWLManager });
                })

                it('should deny changing address without sufficient pre-approved funds using GSN', async function() {
                    assert.equal(await yallToken.allowance(bob, dist.address), 0);

                    await assertGsnReject(
                        dist.changeMyAddress(alice, { from: bob, gasLimit: 9000000, useGSN: true }),
                        GSNRecipientSignatureErrorCodes.INSUFFICIENT_BALANCE
                    );

                    assert.equal(await yallToken.balanceOf(alice), ether(baseAliceBalance));
                    assert.equal(await yallToken.balanceOf(bob), ether(12));
                });

                it('should deny changing address without sufficient funds using GSN', async function() {
                    await yallToken.approve(dist.address, ether('4.2'), { from: bob });
                    await yallToken.burn(bob, ether(11), { from: yallBurner });
                    assert.equal(await yallToken.balanceOf(bob), ether(1));
                    assert.equal(await yallToken.allowance(bob, dist.address), ether('4.2'));

                    await assertGsnReject(
                        dist.changeMyAddress(alice, { from: bob, gasLimit: 9000000, useGSN: true }),
                        GSNRecipientSignatureErrorCodes.INSUFFICIENT_BALANCE
                    );

                    assert.equal(await yallToken.balanceOf(alice), ether(baseAliceBalance));
                    assert.equal(await yallToken.balanceOf(bob), ether(1));
                });

            })

            it('should allow inactive member changing his address', async function() {
                await dist.disableMembers([bob], { from: distributorVerifier });
                await dist.changeMyAddress(alice, { from: bob });

                const details = await dist.member(memberId1);
                assert.equal(details.active, false);
                assert.equal(details.addr, alice);
            });

            it('should deny non member changing the member address', async function() {
                await assertRevert(dist.changeMyAddress(alice, { from: distributorVerifier }), 'Only the member allowed');
            });

            it('should deny an active member changing already occupied address', async function() {
                await assertRevert(dist.changeMyAddress(charlie, { from: bob }), 'Address is already taken by another member');
            });
        });

        describe('#claimFundsMultiple()', () => {
            beforeEach(async function() {
                await increaseTime(11);
                assert.equal(await dist.getCurrentPeriodId(), 0);
                await dist.addMembers([memberId1, memberId2, memberId3], [bob, charlie, dan], { from: distributorVerifier });
                await increaseTime(periodLength);
            });

            it('should allow claiming reward for an active member', async function() {
                const charlieBalanceBefore = await yallToken.balanceOf(charlie);
                const danBalanceBefore = await yallToken.balanceOf(dan);
                await dist.claimFundsMultiple([charlie, dan], { from: distributorVerifier });
                const charlieBalanceAfter = await yallToken.balanceOf(charlie);
                const danBalanceAfter = await yallToken.balanceOf(dan);

                assertErc20BalanceChanged(charlieBalanceBefore, charlieBalanceAfter, ether(75 * 1000));
                assertErc20BalanceChanged(danBalanceBefore, danBalanceAfter, ether(75 * 1000));
            });

            it('should not allow claiming reward twice a period', async function() {
                await dist.claimFunds({ from: charlie });
                await assertRevert(
                    dist.claimFundsMultiple([charlie, dan], { from: distributorVerifier }),
                    'Already claimed for the current period'
                );
            });

            it('should deny claiming a reward for a non-active member', async function() {
                await dist.disableMembers([charlie], { from: distributorVerifier });
                await assertRevert(dist.claimFundsMultiple([charlie, dan], { from: distributorVerifier }), 'YALLDistributor: Not active member');
            });

            it('should deny non-distributorVerifier claiming a reward', async function() {
                await assertRevert(dist.claimFundsMultiple([charlie, dan], { from: charlie }), 'YALLDistributor: Only DISTRIBUTOR_VERIFIER allowed');
            });

            it('should increase totalClaimed value on each successful claim', async function() {
                assert.equal((await dist.period(0)).rewardPerMember, 0);
                assert.equal((await dist.member(memberId2)).totalClaimed, 0);

                // P1
                await dist.claimFundsMultiple([charlie], { from: distributorVerifier });
                assert.equal(await dist.getCurrentPeriodId(), 1);
                assert.equal((await dist.period(1)).rewardPerMember, ether(75 * 1000));
                assert.equal((await dist.member(memberId2)).totalClaimed, ether(75 * 1000));

                // P2
                await increaseTime(periodLength);
                await dist.claimFundsMultiple([charlie], { from: distributorVerifier });
                assert.equal(await dist.getCurrentPeriodId(), 2);
                assert.equal((await dist.period(2)).rewardPerMember, ether(75 * 1000));
                assert.equal((await dist.member(memberId2)).totalClaimed, ether(2 * 75 * 1000));

                await dist.disableMembers([bob], { from: distributorVerifier });

                // P3
                await increaseTime(periodLength);
                await dist.claimFundsMultiple([charlie], { from: distributorVerifier });
                assert.equal(await dist.getCurrentPeriodId(), 3);
                assert.equal((await dist.period(3)).rewardPerMember, ether(112.5 * 1000));
                assert.equal((await dist.member(memberId2)).totalClaimed, ether((2 * 75 + 112.5) * 1000));
            });
        });

        describe('#claimFunds()', () => {
            beforeEach(async function() {
                await increaseTime(11);
                assert.equal(await dist.getCurrentPeriodId(), 0);
                await dist.addMembers([memberId1, memberId2, memberId3], [bob, charlie, dan], { from: distributorVerifier });
                await increaseTime(periodLength);
            });

            it('should allow claiming reward for an active member', async function() {
                const charlieBalanceBefore = await yallToken.balanceOf(charlie);
                await dist.claimFunds({ from: charlie });
                const charlieBalanceAfter = await yallToken.balanceOf(charlie);

                assertErc20BalanceChanged(charlieBalanceBefore, charlieBalanceAfter, ether(75 * 1000));
            });

            it('should allow claiming reward for an active member using GSN', async function() {
                const charlieBalanceBefore = await yallToken.balanceOf(charlie);
                const res = await dist.claimFunds({ from: charlie, useGSN: true });
                assertRelayedCall(res);
                const charlieBalanceAfter = await yallToken.balanceOf(charlie);

                assertErc20BalanceChanged(charlieBalanceBefore, charlieBalanceAfter, ether(75 * 1000));
            });

            it('should deny claiming reward second time using GSN', async function() {
                const charlieBalanceBefore = await yallToken.balanceOf(charlie);
                await dist.claimFunds({ from: charlie, useGSN: false });
                await assertGsnReject(
                    dist.claimFunds({ from: charlie, useGSN: true }),
                    GSNRecipientSignatureErrorCodes.DENIED,
                    'Already claimed for the current period'
                );
                const charlieBalanceAfter = await yallToken.balanceOf(charlie);

                assertErc20BalanceChanged(charlieBalanceBefore, charlieBalanceAfter, ether(75 * 1000));
            });

            it('should not allow claiming reward twice a period', async function() {
                await dist.claimFunds({ from: charlie });
                await assertRevert(dist.claimFunds({ from: charlie }), 'Already claimed for the current period');
            });

            it('should deny claiming a reward for a non-active member', async function() {
                await dist.disableMembers([charlie], { from: distributorVerifier });
                await assertRevert(dist.claimFunds({ from: charlie }), ' YALLDistributor: Not active member');
            });

            it('should increase totalClaimed value on each successful claim', async function() {
                assert.equal((await dist.period(0)).rewardPerMember, 0);
                assert.equal((await dist.member(memberId2)).totalClaimed, 0);

                // P1
                await dist.claimFunds({ from: charlie });
                assert.equal(await dist.getCurrentPeriodId(), 1);
                assert.equal((await dist.period(1)).rewardPerMember, ether(75 * 1000));
                assert.equal((await dist.member(memberId2)).totalClaimed, ether(75 * 1000));

                // P2
                await increaseTime(periodLength);
                await dist.claimFunds({ from: charlie });
                assert.equal(await dist.getCurrentPeriodId(), 2);
                assert.equal((await dist.period(2)).rewardPerMember, ether(75 * 1000));
                assert.equal((await dist.member(memberId2)).totalClaimed, ether(2 * 75 * 1000));

                await dist.disableMembers([bob], { from: distributorVerifier });

                // P3
                await increaseTime(periodLength);
                await dist.claimFunds({ from: charlie });
                assert.equal(await dist.getCurrentPeriodId(), 3);
                assert.equal((await dist.period(3)).rewardPerMember, ether(112.5 * 1000));
                assert.equal((await dist.member(memberId2)).totalClaimed, ether((2 * 75 + 112.5) * 1000));
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
                await increaseTime(10 + periodLength - 4);
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
                await increaseTime(10 + periodLength * 2 - 4);
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

        describe('#isPeriodClaimedByMember()', () => {
            it('should return correct values', async function() {
                await dist.addMembersBeforeGenesis([memberId1], [bob], { from: distributorVerifier });
                await increaseTime(11);

                // P1
                assert.equal(await dist.getCurrentPeriodId(), 0);
                assert.equal(await dist.isPeriodClaimedByMember(memberId1, 0), false);

                await dist.claimFunds({ from: bob });

                assert.equal(await dist.isPeriodClaimedByMember(memberId1, 0), true);

                // P2
                await increaseTime(periodLength);
                assert.equal(await dist.getCurrentPeriodId(), 1);
                assert.equal(await dist.isPeriodClaimedByMember(memberId1, 1), false);

                await dist.claimFunds({ from: bob });

                assert.equal(await dist.isPeriodClaimedByMember(memberId1, 1), true);
            });
        });

        describe('#isPeriodClaimedByAddress()', () => {
            it('should return correct values', async function() {
                await dist.addMembersBeforeGenesis([memberId1], [bob], { from: distributorVerifier });
                await increaseTime(11);

                // P1
                assert.equal(await dist.getCurrentPeriodId(), 0);
                assert.equal(await dist.isPeriodClaimedByAddress(bob, 0), false);

                await dist.claimFunds({ from: bob });

                assert.equal(await dist.isPeriodClaimedByAddress(bob, 0), true);

                // P2
                await increaseTime(periodLength);
                assert.equal(await dist.getCurrentPeriodId(), 1);
                assert.equal(await dist.isPeriodClaimedByAddress(bob, 1), false);

                await dist.claimFunds({ from: bob });

                assert.equal(await dist.isPeriodClaimedByAddress(bob, 1), true);
            });
        });

        describe('#getDataSignature', async function() {
            it('should return correct values', async function() {
                const data = dist.contract.methods.setEmissionPoolRewardShare(123).encodeABI();
                assert.equal(await dist.getDataSignature(data), '0x97688923');
            });
        })
    })
});
