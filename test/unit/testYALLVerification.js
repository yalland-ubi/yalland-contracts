const { accounts, defaultSender } = require('@openzeppelin/test-environment');
// eslint-disable-next-line import/order
const { contract } = require('../twrapper');
const { assert } = require('chai');
const { ether, increaseTime, assertRevert, getResTimestamp } = require('@galtproject/solidity-test-chest')(web3);
const { deployWithProxy, buildCoinDistAndExchange } = require('../builders');

const YALLVerification = contract.fromArtifact('YALLVerification');

YALLVerification.numberFormat = 'String';

describe('YALLVerification Unit tests', () => {
  const [
    distributorVerifier,
    distributorManager,
    gsnFeeCollector,
    feeCollector,
    alice,
    bob,
    charlie,
    dan,
    eve,
    frank,
    governance,
    yallMinter,
    yallBurner,
    feeManager,
    feeClaimer,
    yallTokenManager,
    pauser,
    distributorEmissionClaimer,
  ] = accounts;

  // 7 days
  const periodVolume = ether(250 * 1000);
  let dist;
  let proxyAdmin;
  let registry;
  let verification;

  before(async function () {
    ({ dist, verification, registry, proxyAdmin } = await buildCoinDistAndExchange(defaultSender, {
      periodVolume,
      pauser,
      feeManager,
      feeClaimer,
      distributorManager,
      distributorVerifier,
      distributorEmissionClaimer,
      yallMinter,
      yallBurner,
      yallTokenManager,
      feeCollector,
      gsnFeeCollector,
      governance,
      disableExchange: true,
      disableEmission: true,
      disableCommission: true,
    }));
  });

  describe('Governance Interface', () => {
    describe('#setVerifiers()', () => {
      beforeEach(async function () {
        await increaseTime(11);
        assert.equal(await dist.getCurrentPeriodId(), 0);

        const verificationDeployment = await deployWithProxy(YALLVerification, proxyAdmin.address, registry.address);
        verification = verificationDeployment.contract;
        await registry.setContract(await registry.YALL_VERIFICATION_KEY(), verification.address);
      });

      it('should be initialized with empty values', async function () {
        assert.sameMembers(await verification.getActiveVerifiers(), []);
        assert.equal(await verification.getActiveVerifierCount(), 0);
        assert.equal(await verification.required(), 0);
      });

      it('should be able setting an initial address set', async function () {
        const res = await verification.setVerifiers([alice, bob, charlie], 2, { from: governance });
        const createdAt = await getResTimestamp(res);

        assert.equal(res.logs[0].event, 'AddVerifier');
        assert.equal(res.logs[0].args.verifier, alice);
        assert.equal(res.logs[1].event, 'AddVerifier');
        assert.equal(res.logs[1].args.verifier, bob);
        assert.equal(res.logs[2].event, 'AddVerifier');
        assert.equal(res.logs[2].args.verifier, charlie);

        assert.sameMembers(await verification.getActiveVerifiers(), [alice, bob, charlie]);
        assert.equal(await verification.getActiveVerifierCount(), 3);
        assert.equal(await verification.required(), 2);

        const aliceDetails = await verification.verifiers(alice);
        assert.equal(aliceDetails.active, true);
        assert.equal(aliceDetails.createdAt, createdAt);
        assert.equal(aliceDetails.lastEnabledAt, 0);
        assert.equal(aliceDetails.lastDisabledAt, 0);

        const bobDetails = await verification.verifiers(bob);
        assert.equal(bobDetails.active, true);
        assert.equal(bobDetails.createdAt, createdAt);
        assert.equal(bobDetails.lastEnabledAt, 0);
        assert.equal(bobDetails.lastDisabledAt, 0);

        const charlieDetails = await verification.verifiers(charlie);
        assert.equal(charlieDetails.active, true);
        assert.equal(charlieDetails.createdAt, createdAt);
        assert.equal(charlieDetails.lastEnabledAt, 0);
        assert.equal(charlieDetails.lastDisabledAt, 0);
      });

      it('should reject an empty verifier set', async function () {
        await assertRevert(
          verification.setVerifiers([], 0, { from: governance }),
          'YALLVerification: Missing input verifiers'
        );
      });

      it('should deny address duplicate for a new set', async function () {
        await assertRevert(
          verification.setVerifiers([alice, alice, charlie], 2, { from: governance }),
          'YALLVerification: Verifier is already enabled'
        );
      });

      describe('required value', () => {
        it('could be equal to the new verifier set', async function () {
          await verification.setVerifiers([alice, bob, charlie], 3, { from: governance });
        });

        it('cant be 0', async function () {
          await assertRevert(
            verification.setVerifiers([alice, bob, charlie], 0, { from: governance }),
            'YALLVerification: newRequired should be greater than 0'
          );
        });

        it('cant be greater than verifiers length', async function () {
          await assertRevert(
            verification.setVerifiers([alice, bob, charlie], 4, { from: governance }),
            'Requires verifiers.length >= newRequired'
          );
        });
      });

      describe('with existing members', () => {
        let initialCall;

        beforeEach(async function () {
          const res = await verification.setVerifiers([alice, bob, charlie], 2, { from: governance });
          initialCall = await getResTimestamp(res);
        });

        it('should change the existing verifier set with a non intersecting new one', async function () {
          const res = await verification.setVerifiers([dan, eve], 1, { from: governance });
          const callTime = await getResTimestamp(res);

          // disable verifiers
          assert.equal(res.logs[0].event, 'DisableVerifier');
          assert.equal(res.logs[0].args.verifier, alice);
          assert.equal(res.logs[1].event, 'DisableVerifier');
          assert.equal(res.logs[1].args.verifier, bob);
          assert.equal(res.logs[2].event, 'DisableVerifier');
          assert.equal(res.logs[2].args.verifier, charlie);

          // add verifiers
          assert.equal(res.logs[3].event, 'AddVerifier');
          assert.equal(res.logs[3].args.verifier, dan);
          assert.equal(res.logs[4].event, 'AddVerifier');
          assert.equal(res.logs[4].args.verifier, eve);

          assert.sameMembers(await verification.getActiveVerifiers(), [dan, eve]);
          assert.equal(await verification.getActiveVerifierCount(), 2);
          assert.equal(await verification.required(), 1);

          const aliceDetails = await verification.verifiers(alice);
          assert.equal(aliceDetails.active, false);
          assert.equal(aliceDetails.createdAt, initialCall);
          assert.equal(aliceDetails.lastEnabledAt, 0);
          assert.equal(aliceDetails.lastDisabledAt, callTime);

          const bobDetails = await verification.verifiers(bob);
          assert.equal(bobDetails.active, false);
          assert.equal(bobDetails.createdAt, initialCall);
          assert.equal(bobDetails.lastEnabledAt, 0);
          assert.equal(bobDetails.lastDisabledAt, callTime);

          const charlieDetails = await verification.verifiers(charlie);
          assert.equal(charlieDetails.active, false);
          assert.equal(charlieDetails.createdAt, initialCall);
          assert.equal(charlieDetails.lastEnabledAt, 0);
          assert.equal(charlieDetails.lastDisabledAt, callTime);

          const danDetails = await verification.verifiers(dan);
          assert.equal(danDetails.active, true);
          assert.equal(danDetails.createdAt, callTime);
          assert.equal(danDetails.lastEnabledAt, 0);
          assert.equal(danDetails.lastDisabledAt, 0);

          const eveDetails = await verification.verifiers(eve);
          assert.equal(eveDetails.active, true);
          assert.equal(eveDetails.createdAt, callTime);
          assert.equal(eveDetails.lastEnabledAt, 0);
          assert.equal(eveDetails.lastDisabledAt, 0);
        });

        it('should merge existing verifiers with a intersecting new one', async function () {
          const res = await verification.setVerifiers([alice, dan, eve], 3, { from: governance });
          const callTime = await getResTimestamp(res);

          // disable verifiers
          assert.equal(res.logs[0].event, 'DisableVerifier');
          assert.equal(res.logs[0].args.verifier, bob);
          assert.equal(res.logs[1].event, 'DisableVerifier');
          assert.equal(res.logs[1].args.verifier, charlie);

          // add verifiers
          assert.equal(res.logs[2].event, 'AddVerifier');
          assert.equal(res.logs[2].args.verifier, dan);
          assert.equal(res.logs[3].event, 'AddVerifier');
          assert.equal(res.logs[3].args.verifier, eve);

          assert.sameMembers(await verification.getActiveVerifiers(), [alice, dan, eve]);
          assert.equal(await verification.getActiveVerifierCount(), 3);
          assert.equal(await verification.required(), 3);

          const aliceDetails = await verification.verifiers(alice);
          assert.equal(aliceDetails.active, true);
          assert.equal(aliceDetails.createdAt, initialCall);
          assert.equal(aliceDetails.lastEnabledAt, 0);
          assert.equal(aliceDetails.lastDisabledAt, 0);

          const bobDetails = await verification.verifiers(bob);
          assert.equal(bobDetails.active, false);
          assert.equal(bobDetails.createdAt, initialCall);
          assert.equal(bobDetails.lastEnabledAt, 0);
          assert.equal(bobDetails.lastDisabledAt, callTime);

          const charlieDetails = await verification.verifiers(charlie);
          assert.equal(charlieDetails.active, false);
          assert.equal(charlieDetails.createdAt, initialCall);
          assert.equal(charlieDetails.lastEnabledAt, 0);
          assert.equal(charlieDetails.lastDisabledAt, callTime);

          const danDetails = await verification.verifiers(dan);
          assert.equal(danDetails.active, true);
          assert.equal(danDetails.createdAt, callTime);
          assert.equal(danDetails.lastEnabledAt, 0);
          assert.equal(danDetails.lastDisabledAt, 0);

          const eveDetails = await verification.verifiers(eve);
          assert.equal(eveDetails.active, true);
          assert.equal(eveDetails.createdAt, callTime);
          assert.equal(eveDetails.lastEnabledAt, 0);
          assert.equal(eveDetails.lastDisabledAt, 0);
        });

        it('should merge existing verifiers with an already disabled/intersecting new one', async function () {
          let res = await verification.setVerifiers([alice, dan, eve], 3, { from: governance });
          const secondCall = await getResTimestamp(res);

          assert.sameMembers(await verification.getActiveVerifiers(), [alice, dan, eve]);
          assert.equal(await verification.getActiveVerifierCount(), 3);
          assert.equal(await verification.required(), 3);

          res = await verification.setVerifiers([alice, bob, charlie, dan, frank], 3, { from: governance });
          const callTime = await getResTimestamp(res);

          // disable verifiers
          assert.equal(res.logs[0].event, 'DisableVerifier');
          assert.equal(res.logs[0].args.verifier, eve);

          // enable verifiers
          assert.equal(res.logs[1].event, 'EnableVerifier');
          assert.equal(res.logs[1].args.verifier, bob);
          assert.equal(res.logs[2].event, 'EnableVerifier');
          assert.equal(res.logs[2].args.verifier, charlie);

          // add verifiers
          assert.equal(res.logs[3].event, 'AddVerifier');
          assert.equal(res.logs[3].args.verifier, frank);

          assert.sameMembers(await verification.getActiveVerifiers(), [alice, bob, charlie, dan, frank]);
          assert.equal(await verification.getActiveVerifierCount(), 5);
          assert.equal(await verification.required(), 3);

          const aliceDetails = await verification.verifiers(alice);
          assert.equal(aliceDetails.active, true);
          assert.equal(aliceDetails.createdAt, initialCall);
          assert.equal(aliceDetails.lastEnabledAt, 0);
          assert.equal(aliceDetails.lastDisabledAt, 0);

          const bobDetails = await verification.verifiers(bob);
          assert.equal(bobDetails.active, true);
          assert.equal(bobDetails.createdAt, initialCall);
          assert.equal(bobDetails.lastEnabledAt, callTime);
          assert.equal(bobDetails.lastDisabledAt, secondCall);

          const charlieDetails = await verification.verifiers(charlie);
          assert.equal(charlieDetails.active, true);
          assert.equal(charlieDetails.createdAt, initialCall);
          assert.equal(charlieDetails.lastEnabledAt, callTime);
          assert.equal(charlieDetails.lastDisabledAt, secondCall);

          const danDetails = await verification.verifiers(dan);
          assert.equal(danDetails.active, true);
          assert.equal(danDetails.createdAt, secondCall);
          assert.equal(danDetails.lastEnabledAt, 0);
          assert.equal(danDetails.lastDisabledAt, 0);

          const eveDetails = await verification.verifiers(eve);
          assert.equal(eveDetails.active, false);
          assert.equal(eveDetails.createdAt, secondCall);
          assert.equal(eveDetails.lastEnabledAt, 0);
          assert.equal(eveDetails.lastDisabledAt, callTime);

          const frankDetails = await verification.verifiers(frank);
          assert.equal(frankDetails.active, true);
          assert.equal(frankDetails.createdAt, callTime);
          assert.equal(frankDetails.lastEnabledAt, 0);
          assert.equal(frankDetails.lastDisabledAt, 0);
        });
      });
    });
  });
});
