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

const CoinToken = contract.fromArtifact('CoinToken');
const YALDistributor = contract.fromArtifact('YALDistributor');
const Proxy = contract.fromArtifact('OwnedUpgradeabilityProxy');
const { approveFunction, assertRelayedCall, GSNRecipientSignatureErrorCodes } = require('../helpers')(web3);

CoinToken.numberFormat = 'String';
YALDistributor.numberFormat = 'String';

const { ether, now, int, increaseTime, assertRevert, assertGsnReject, zeroAddress, getResTimestamp, assertErc20BalanceChanged } = require('@galtproject/solidity-test-chest')(web3);

const keccak256 = web3.utils.soliditySha3;

describe('YALDistributor Unit tests', () => {
    const [verifier, alice, bob, charlie, dan, eve, minter, burner, feeManager, transferWlManager] = accounts;

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
        coinToken = await CoinToken.new(alice, "Coin token", "COIN", 18);
        const distProxy = await Proxy.new();
        const distImplementation = await YALDistributor.new();
        dist = await YALDistributor.new();
        const distInitTx = distImplementation.contract.methods.initialize(
            periodVolume,
            verifier,
            verifierRewardShare,

            coinToken.address,
            periodLength,
            genesisTimestamp
        ).encodeABI();

        await distProxy.upgradeToAndCall(distImplementation.address, distInitTx);
        dist = await YALDistributor.at(distProxy.address);

        await coinToken.addRoleTo(dist.address, "minter");
        await coinToken.addRoleTo(dist.address, "burner");
        await coinToken.addRoleTo(minter, 'minter');
        await coinToken.addRoleTo(burner, 'burner');
        await coinToken.addRoleTo(feeManager, 'fee_manager');
        await coinToken.addRoleTo(transferWlManager, 'transfer_wl_manager');

        await coinToken.setDistributor(dist.address);
        await coinToken.mint(alice, ether(baseAliceBalance), { from: minter });
        await coinToken.setTransferFee(ether('0.02'), { from: feeManager });
        await coinToken.setGsnFee(ether('1.7'), { from: feeManager });

        await dist.setGsnFee(ether('4.2'));

        // this will affect on dist provider too
        coinToken.contract.currentProvider.wrappedProvider.relayClient.approveFunction = approveFunction;

        await deployRelayHub(web3);
        await fundRecipient(web3, { recipient: dist.address, amount: ether(1) });
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
                const res = await dist.disableMembers([bob], { from: verifier });
                const disabledAt = await getResTimestamp(res);

                const details = await dist.member(memberId1);
                assert.equal(details.active, false);
                assert.equal(details.addr, bob);
                assert.equal(details.lastDisabledAt, disabledAt);
                assert.equal(details.lastEnabledAt, 0);
            });

            it('should decrement activeMemberCount for a single item', async function() {
                assert.equal(await dist.activeMemberCount(), 3);
                await dist.disableMembers([bob], { from: verifier });
                assert.equal(await dist.activeMemberCount(), 2);
            });

            it('should decrement activeMemberCount for multiple items', async function() {
                assert.equal(await dist.activeMemberCount(), 3);
                await dist.disableMembers([bob, charlie, dan], { from: verifier });
                assert.equal(await dist.activeMemberCount(), 0);
            });

            it('should deny disabling if one of the members is inactive', async function() {
                await dist.disableMembers([bob], { from: verifier });
                await assertRevert(
                    dist.disableMembers([bob, charlie, dan], { from: verifier }),
                    'One of the members is inactive'
                );
            });

            it('should deny non verifier disabling a member', async function() {
                await assertRevert(dist.disableMembers([bob], { from: alice }), 'Only verifier allowed');
            });

            it('should deny disabling an empty list', async function() {
                await assertRevert(dist.disableMembers([], { from: verifier }), 'Missing input members');
            });

            it('should deny disabling non existent member', async function() {
                await assertRevert(
                    dist.disableMembers([alice], { from: verifier }),
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
                await dist.disableMembers([bob, charlie, dan], { from: verifier });
            });

            it('should allow enabled inactive member', async function() {
                const res = await dist.enableMembers([bob], { from: verifier });
                const enabledAt = await getResTimestamp(res);

                const details = await dist.member(memberId1);
                assert.equal(details.active, true);
                assert.equal(details.addr, bob);
                assert.equal(details.lastEnabledAt, enabledAt);
            });

            it('should increment activeMemberCount for a single item', async function() {
                assert.equal(await dist.activeMemberCount(), 0);
                await dist.enableMembers([bob], { from: verifier });
                assert.equal(await dist.activeMemberCount(), 1);
            });

            it('should decrement activeMemberCount for multiple items', async function() {
                assert.equal(await dist.activeMemberCount(), 0);
                await dist.enableMembers([bob, charlie, dan], { from: verifier });
                assert.equal(await dist.activeMemberCount(), 3);
            });

            it('should deny enabling if one of the members is active', async function() {
                await dist.enableMembers([bob], { from: verifier });
                await assertRevert(
                    dist.enableMembers([bob, charlie, dan], { from: verifier }),
                    'One of the members is active'
                );
            });

            it('should deny non verifier enabling a member', async function() {
                await assertRevert(dist.enableMembers([bob], { from: alice }), 'Only verifier allowed');
            });

            it('should deny enabling an empty list', async function() {
                await assertRevert(dist.enableMembers([], { from: verifier }), 'Missing input members');
            });

            it('should deny enabling non existent member', async function() {
                await assertRevert(
                    dist.enableMembers([alice], { from: verifier }),
                    'Member doesn\'t exist'
                );
            });
        });

        describe('#changeMemberAddress()', () => {
            beforeEach(async function() {
                await increaseTime(11);
                assert.equal(await dist.getCurrentPeriodId(), 0);
                await dist.addMember(memberId1, bob, { from: verifier });
                await dist.addMember(memberId2, charlie, { from: verifier });
            });

            it('should allow changing address for an active member', async function() {
                assert.equal(await dist.memberAddress2Id(bob), memberId1);
                assert.equal(
                    await dist.memberAddress2Id(alice),
                    '0x0000000000000000000000000000000000000000000000000000000000000000'
                );

                const res = await dist.changeMemberAddress(bob, alice, { from: verifier });

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
                await dist.disableMembers([bob], { from: verifier });
                await dist.changeMemberAddress(bob, alice, { from: verifier });

                const details = await dist.member(memberId1);
                assert.equal(details.active, false);
                assert.equal(details.addr, alice);
            });

            it('should deny non verifier changing a member address', async function() {
                await assertRevert(dist.changeMemberAddress(bob, alice, { from: alice }), 'Only verifier allowed');
            });

            it('should deny changing a non-existent member address', async function() {
                await assertRevert(dist.changeMemberAddress(dan, alice, { from: verifier }), 'Member doesn\'t exist');
            });

            it('should deny changing to an already occupied address', async function() {
                await assertRevert(
                    dist.changeMemberAddress(bob, charlie, { from: verifier }),
                    'Address is already taken by another member'
                );
            });
        });

        describe('#changeMemberAddresses()', () => {
            beforeEach(async function() {
                await increaseTime(11);
                assert.equal(await dist.getCurrentPeriodId(), 0);
                await dist.addMember(memberId1, bob, { from: verifier });
                await dist.addMember(memberId2, charlie, { from: verifier });
                await dist.addMember(memberId3, dan, { from: verifier });
            });

            it('should allow changing address for an active member', async function() {
                assert.equal(await dist.memberAddress2Id(dan), memberId3);
                assert.equal(await dist.memberAddress2Id(bob), memberId1);
                assert.equal(
                    await dist.memberAddress2Id(alice),
                    '0x0000000000000000000000000000000000000000000000000000000000000000'
                );

                // bob => alice && dan => bob
                await dist.changeMemberAddresses([bob, dan], [alice, bob], { from: verifier });

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
                await dist.disableMembers([bob], { from: verifier });
                await dist.changeMemberAddresses([bob, charlie], [alice, bob], { from: verifier });

                const details = await dist.member(memberId1);
                assert.equal(details.active, false);
                assert.equal(details.addr, alice);
            });

            it('should deny non verifier changing a member address', async function() {
                await assertRevert(
                    dist.changeMemberAddresses([bob], [alice], { from: alice }),
                    'Only verifier allowed'
                );
            });

            it('should deny changing a non-existent member address', async function() {
                await assertRevert(
                    dist.changeMemberAddresses([eve, dan], [alice, alice], { from: verifier }),
                    'Member doesn\'t exist'
                );
            });

            it('should deny changing to an already occupied address', async function() {
                await assertRevert(
                    dist.changeMemberAddresses([bob], [charlie], { from: verifier }),
                    'Address is already taken by another member'
                );
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

        describe('#withdrawFee()', () => {
            beforeEach(async function() {
                await increaseTime(11);
                await dist.addMembers([keccak256('bob')], [bob], { from: verifier })
                await coinToken.setWhitelistAddress(dist.address, true, { from: transferWlManager });
                await coinToken.setWhitelistAddress(defaultSender, true, { from: transferWlManager });
                await dist.changeMyAddress(alice, { from: bob });

                await coinToken.transfer(dist.address, ether(42), { from: alice })
            })

            it('should allow owner withdrawing fee', async function() {
                assert.equal(await coinToken.balanceOf(defaultSender), 0);
                await dist.withdrawFee();
                assert.equal(await coinToken.balanceOf(defaultSender), ether('41.98'));
            });

            it('should deny non-owner withdrawing fee', async function() {
                await assertRevert(dist.withdrawFee({ from: alice }), 'Ownable: caller is not the owner');
            });
        });

        describe('#pause()/#unpause()', () => {
            it('should allow the owner pausing/unpausing contract', async function() {
                assert.equal(await dist.paused(), false);
                await dist.pause();
                assert.equal(await dist.paused(), true);
                await dist.unpause();
                assert.equal(await dist.paused(), false);
            });

            it('should deny non-owner pausing/unpausing contract', async function() {
                await assertRevert(dist.pause({ from: verifier }), 'Ownable: caller is not the owner');
                await assertRevert(dist.unpause({ from: verifier }), 'Ownable: caller is not the owner');
            });
        });
    });

    describe('Member Interface', () => {
        describe('#changeMyAddress()', () => {
            beforeEach(async function() {
                await increaseTime(11);
                assert.equal(await dist.getCurrentPeriodId(), 0);
                await dist.addMember(memberId1, bob, { from: verifier });
                await dist.addMember(memberId2, charlie, { from: verifier });
            });

            it('should allow an active member changing his address', async function() {
                assert.equal(await dist.memberAddress2Id(bob), memberId1);
                assert.equal(
                    await dist.memberAddress2Id(alice),
                    '0x0000000000000000000000000000000000000000000000000000000000000000'
                );

                await coinToken.burn(alice, ether(baseAliceBalance), { from: burner });
                assert.equal(await coinToken.balanceOf(alice), ether(0));
                assert.equal(await coinToken.balanceOf(bob), ether(0));

                await dist.changeMyAddress(alice, { from: bob });

                assert.equal(await coinToken.balanceOf(alice), ether(0));
                assert.equal(await coinToken.balanceOf(bob), ether(0));

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

                await coinToken.setWhitelistAddress(dist.address, true, { from: transferWlManager });

                await coinToken.mint(dist.address, ether(12), { from: minter });
                await coinToken.mint(bob, ether(12), { from: minter });
                await coinToken.mint(charlie, ether(12), { from: minter });
                await coinToken.transfer(charlie, ether(1), { from: charlie });

                assert.equal(await coinToken.balanceOf(alice), ether(baseAliceBalance));
                assert.equal(await coinToken.balanceOf(bob), ether(12));

                await coinToken.approve(dist.address, await ether(4.2), { from: bob });
                const res = await dist.changeMyAddress(alice, { from: bob, gasLimit: 9000000, useGSN: true });
                assertRelayedCall(res);

                assert.equal(await coinToken.balanceOf(alice), ether(baseAliceBalance + 12 - 4.2));
                assert.equal(await coinToken.balanceOf(bob), ether(0));

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
                    await coinToken.mint(bob, ether(12), { from: minter });
                    assert.equal(await coinToken.balanceOf(alice), ether(baseAliceBalance));
                    assert.equal(await coinToken.balanceOf(bob), ether(12));
                    assert.equal(await dist.gsnFee(), ether('4.2'));
                    await coinToken.setWhitelistAddress(dist.address, true, { from: transferWlManager });
                })

                it('should deny changing address without sufficient pre-approved funds using GSN', async function() {
                    assert.equal(await coinToken.allowance(bob, dist.address), 0);

                    await assertGsnReject(
                        dist.changeMyAddress(alice, { from: bob, gasLimit: 9000000, useGSN: true }),
                        GSNRecipientSignatureErrorCodes.INSUFFICIENT_BALANCE
                    );

                    assert.equal(await coinToken.balanceOf(alice), ether(baseAliceBalance));
                    assert.equal(await coinToken.balanceOf(bob), ether(12));
                });

                it('should deny changing address without sufficient funds using GSN', async function() {
                    await coinToken.approve(dist.address, ether('4.2'), { from: bob });
                    await coinToken.burn(bob, ether(11), { from: burner });
                    assert.equal(await coinToken.balanceOf(bob), ether(1));
                    assert.equal(await coinToken.allowance(bob, dist.address), ether('4.2'));

                    await assertGsnReject(
                        dist.changeMyAddress(alice, { from: bob, gasLimit: 9000000, useGSN: true }),
                        GSNRecipientSignatureErrorCodes.INSUFFICIENT_BALANCE
                    );

                    assert.equal(await coinToken.balanceOf(alice), ether(baseAliceBalance));
                    assert.equal(await coinToken.balanceOf(bob), ether(1));
                });

            })

            it('should allow inactive member changing his address', async function() {
                await dist.disableMembers([bob], { from: verifier });
                await dist.changeMyAddress(alice, { from: bob });

                const details = await dist.member(memberId1);
                assert.equal(details.active, false);
                assert.equal(details.addr, alice);
            });

            it('should deny non member changing the member address', async function() {
                await assertRevert(dist.changeMyAddress(alice, { from: verifier }), 'Only the member allowed');
            });

            it('should deny an active member changing already occupied address', async function() {
                await assertRevert(dist.changeMyAddress(charlie, { from: bob }), 'Address is already taken by another member');
            });
        });

        describe('#claimFundsMultiple()', () => {
            beforeEach(async function() {
                await increaseTime(11);
                assert.equal(await dist.getCurrentPeriodId(), 0);
                await dist.addMembers([memberId1, memberId2, memberId3], [bob, charlie, dan], { from: verifier });
                await increaseTime(periodLength);
            });

            it('should allow claiming reward for an active member', async function() {
                const charlieBalanceBefore = await coinToken.balanceOf(charlie);
                const danBalanceBefore = await coinToken.balanceOf(dan);
                await dist.claimFundsMultiple([charlie, dan], { from: verifier });
                const charlieBalanceAfter = await coinToken.balanceOf(charlie);
                const danBalanceAfter = await coinToken.balanceOf(dan);

                assertErc20BalanceChanged(charlieBalanceBefore, charlieBalanceAfter, ether(75 * 1000));
                assertErc20BalanceChanged(danBalanceBefore, danBalanceAfter, ether(75 * 1000));
            });

            it('should not allow claiming reward twice a period', async function() {
                await dist.claimFunds({ from: charlie });
                await assertRevert(
                    dist.claimFundsMultiple([charlie, dan], { from: verifier }),
                    'Already claimed for the current period'
                );
            });

            it('should deny claiming a reward for a non-active member', async function() {
                await dist.disableMembers([charlie], { from: verifier });
                await assertRevert(dist.claimFundsMultiple([charlie, dan], { from: verifier }), 'Not active member');
            });

            it('should deny non-verifier claiming a reward', async function() {
                await assertRevert(dist.claimFundsMultiple([charlie, dan], { from: charlie }), 'Only verifier allowed');
            });

            it('should increase totalClaimed value on each successful claim', async function() {
                assert.equal((await dist.period(0)).rewardPerMember, 0);
                assert.equal((await dist.member(memberId2)).totalClaimed, 0);

                // P1
                await dist.claimFundsMultiple([charlie], { from: verifier });
                assert.equal(await dist.getCurrentPeriodId(), 1);
                assert.equal((await dist.period(1)).rewardPerMember, ether(75 * 1000));
                assert.equal((await dist.member(memberId2)).totalClaimed, ether(75 * 1000));

                // P2
                await increaseTime(periodLength);
                await dist.claimFundsMultiple([charlie], { from: verifier });
                assert.equal(await dist.getCurrentPeriodId(), 2);
                assert.equal((await dist.period(2)).rewardPerMember, ether(75 * 1000));
                assert.equal((await dist.member(memberId2)).totalClaimed, ether(2 * 75 * 1000));

                await dist.disableMembers([bob], { from: verifier });

                // P3
                await increaseTime(periodLength);
                await dist.claimFundsMultiple([charlie], { from: verifier });
                assert.equal(await dist.getCurrentPeriodId(), 3);
                assert.equal((await dist.period(3)).rewardPerMember, ether(112.5 * 1000));
                assert.equal((await dist.member(memberId2)).totalClaimed, ether((2 * 75 + 112.5) * 1000));
            });
        });

        describe('#claimFunds()', () => {
            beforeEach(async function() {
                await increaseTime(11);
                assert.equal(await dist.getCurrentPeriodId(), 0);
                await dist.addMembers([memberId1, memberId2, memberId3], [bob, charlie, dan], { from: verifier });
                await increaseTime(periodLength);
            });

            it('should allow claiming reward for an active member', async function() {
                const charlieBalanceBefore = await coinToken.balanceOf(charlie);
                await dist.claimFunds({ from: charlie });
                const charlieBalanceAfter = await coinToken.balanceOf(charlie);

                assertErc20BalanceChanged(charlieBalanceBefore, charlieBalanceAfter, ether(75 * 1000));
            });

            it('should allow claiming reward for an active member using GSN', async function() {
                const charlieBalanceBefore = await coinToken.balanceOf(charlie);
                const res = await dist.claimFunds({ from: charlie, useGSN: true });
                assertRelayedCall(res);
                const charlieBalanceAfter = await coinToken.balanceOf(charlie);

                assertErc20BalanceChanged(charlieBalanceBefore, charlieBalanceAfter, ether(75 * 1000));
            });

            it('should deny claiming reward second time using GSN', async function() {
                const charlieBalanceBefore = await coinToken.balanceOf(charlie);
                await dist.claimFunds({ from: charlie, useGSN: false });
                await assertGsnReject(
                    dist.claimFunds({ from: charlie, useGSN: true }),
                    GSNRecipientSignatureErrorCodes.DENIED,
                    'Already claimed for the current period'
                );
                const charlieBalanceAfter = await coinToken.balanceOf(charlie);

                assertErc20BalanceChanged(charlieBalanceBefore, charlieBalanceAfter, ether(75 * 1000));
            });

            it('should not allow claiming reward twice a period', async function() {
                await dist.claimFunds({ from: charlie });
                await assertRevert(dist.claimFunds({ from: charlie }), 'Already claimed for the current period');
            });

            it('should deny claiming a reward for a non-active member', async function() {
                await dist.disableMembers([charlie], { from: verifier });
                await assertRevert(dist.claimFunds({ from: charlie }), ' Not active member');
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

                await dist.disableMembers([bob], { from: verifier });

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

        describe('#isPeriodClaimedByMember()', () => {
            it('should return correct values', async function() {
                await dist.addMembersBeforeGenesis([memberId1], [bob], { from: verifier });
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
                await dist.addMembersBeforeGenesis([memberId1], [bob], { from: verifier });
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
                const data = dist.contract.methods.setVerifier(alice).encodeABI();
                assert.equal(await dist.getDataSignature(data), '0x5437988d');
            });
        })
    })
});
