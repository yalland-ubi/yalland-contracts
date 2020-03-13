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

const { ether, assertRevert, zeroAddress, assertErc20BalanceChanged } = require('@galtproject/solidity-test-chest')(web3);


describe('YALDistributor Unit tests', () => {
    const [pauser, verifier, alice, bob, charlie] = accounts;
    const deployer = defaultSender;

    // 7 days
    const genesisTimestamp = 123;
    const periodLength = 7 * 24 * 60 * 60;
    const periodVolume = ether(250 * 1000);
    const verifierRewardShare = ether(10);
    const baseAliceBalance = 10000000;
    const feePercent = 0.02;
    let coinToken;
    let yalDistributor;

    beforeEach(async function () {
        coinToken = await CoinToken.new("Coin token", "COIN", 18);
        yalDistributor = await YALDistributor.new(
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

    describe('Owner Interface', () => {
        describe('#setVerifier()', () => {
            it('should allow owner setting a new verifier', async function() {
                assert.equal(await yalDistributor.verifier(), verifier);
                await yalDistributor.setVerifier(bob);
                assert.equal(await yalDistributor.verifier(), bob);
            });

            it('should allow owner setting address(0) as a verifier', async function() {
                await yalDistributor.setVerifier(zeroAddress);
                assert.equal(await yalDistributor.verifier(), zeroAddress);
            });

            it('should deny non-owner setting a new verifier', async function() {
                await assertRevert(yalDistributor.setVerifier(bob, { from: alice }), 'Ownable: caller is not the owner');
            });
        });

        describe('#setVerifierRewardShare()', () => {
            it('should allow owner setting a new verifierRewardShare', async function() {
                assert.equal(await yalDistributor.verifierRewardShare(), ether(10));
                await yalDistributor.setVerifierRewardShare(ether(15));
                assert.equal(await yalDistributor.verifierRewardShare(), ether(15));
            });

            it('should allow owner setting a 0 verifierRewardShare', async function() {
                await yalDistributor.setVerifierRewardShare(ether(0));
                assert.equal(await yalDistributor.verifierRewardShare(), 0);
            });

            it('should deny owner setting a verifierRewardShare greater than 100%', async function() {
                await assertRevert(yalDistributor.setVerifierRewardShare(ether(100)), 'Can\'t be >= 100%');
                await assertRevert(yalDistributor.setVerifierRewardShare(ether(101)), 'Can\'t be >= 100%');
            });

            it('should deny non-owner setting a new verifierRewardShare', async function() {
                await assertRevert(yalDistributor.setVerifierRewardShare(ether(15), { from: alice }), 'Ownable: caller is not the owner');
            });
        });

        describe('#setPeriodVolume()', () => {
            it('should allow owner setting a new periodVolume', async function() {
                assert.equal(await yalDistributor.periodVolume(), ether(250 * 1000));
                await yalDistributor.setPeriodVolume(ether(123));
                assert.equal(await yalDistributor.periodVolume(), ether(123));
            });

            it('should allow owner setting a 0 periodVolume', async function() {
                await yalDistributor.setPeriodVolume(0);
                assert.equal(await yalDistributor.periodVolume(), 0);
            });

            it('should deny non-owner setting a new periodVolume', async function() {
                await assertRevert(yalDistributor.setPeriodVolume(ether(123), { from: alice }), 'Ownable: caller is not the owner');
            });
        });
    });
});
