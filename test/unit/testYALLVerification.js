const { accounts, defaultSender } = require('@openzeppelin/test-environment');
// eslint-disable-next-line import/order
const { contract } = require('../twrapper');
const { assert } = require('chai');
const { ether, increaseTime, assertRevert, getResTimestamp } = require('@galtproject/solidity-test-chest')(web3);
const { deployWithProxy, buildCoinDistAndExchange } = require('../builders');

const YALLVerification = contract.fromArtifact('YALLVerification');

YALLVerification.numberFormat = 'String';

const keccak256 = web3.utils.soliditySha3;

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
    george,
    foo,
    bar,
    buzz,
    aliceVerification,
    bobVerification,
    charlieVerification,
    danVerification,
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

  describe('Getters', () => {
    const alicePayout = web3.eth.accounts.create().address;
    const aliceDataManagement = web3.eth.accounts.create().address;

    const bobPayout = web3.eth.accounts.create().address;
    const bobDataManagement = web3.eth.accounts.create().address;
    beforeEach(async function () {
      await verification.setVerifiers([alice, bob, charlie], 2, { from: governance });
      await verification.setVerifiers([bob, charlie], 2, { from: governance });
      // now bob is active and alice is inactive

      await verification.setVerifierAddresses(aliceVerification, alicePayout, aliceDataManagement, { from: alice });
      await verification.setVerifierAddresses(bobVerification, bobPayout, bobDataManagement, { from: bob });
    });

    it('provide correct getters for minor key statuses', async function () {
      const aliceDetails = await verification.verifiers(alice);
      assert.equal(aliceDetails.active, false);
      const bobDetails = await verification.verifiers(bob);
      assert.equal(bobDetails.active, true);

      assert.equal(await verification.isVerificationAddressActive(alice, aliceVerification), false);
      assert.equal(await verification.isPayoutAddressActive(alice, alicePayout), false);
      assert.equal(await verification.isDataManagementAddressActive(alice, aliceDataManagement), false);

      assert.equal(await verification.isVerificationAddressActive(alice, bobVerification), false);
      assert.equal(await verification.isPayoutAddressActive(alice, bobPayout), false);
      assert.equal(await verification.isDataManagementAddressActive(alice, bobDataManagement), false);

      assert.equal(await verification.isVerificationAddressActive(bob, bobVerification), true);
      assert.equal(await verification.isPayoutAddressActive(bob, bobPayout), true);
      assert.equal(await verification.isDataManagementAddressActive(bob, bobDataManagement), true);

      assert.equal(await verification.isVerificationAddressActive(bob, aliceVerification), false);
      assert.equal(await verification.isPayoutAddressActive(bob, alicePayout), false);
      assert.equal(await verification.isDataManagementAddressActive(bob, aliceDataManagement), false);
    });

    it('should provide methods for counting txs', async function () {
      const memberId1 = keccak256('memberId1');
      const data = dist.contract.methods.addMember(memberId1, eve).encodeABI();

      assert.equal(await verification.getTransactionCount(true, false), 0);

      await verification.submitTransaction(dist.address, 0, data, bob, { from: bobVerification });
      await verification.submitTransaction(dist.address, 0, data, bob, { from: bobVerification });
      await verification.submitTransaction(dist.address, 0, data, bob, { from: bobVerification });
      await verification.submitTransaction(dist.address, 0, data, bob, { from: bobVerification });

      assert.equal(await verification.getTransactionCount(true, false), 4);
    });
  });

  describe('Verifier Interface', () => {
    beforeEach(async function () {
      await increaseTime(11);
      assert.equal(await dist.getCurrentPeriodId(), 0);

      const verificationDeployment = await deployWithProxy(YALLVerification, proxyAdmin.address, registry.address);
      verification = verificationDeployment.contract;
      await registry.setContract(await registry.YALL_VERIFICATION_KEY(), verification.address);
      await verification.setVerifiers([alice, bob, charlie], 2, { from: governance });
      await verification.setVerifiers([bob, charlie, dan, eve, frank], 3, { from: governance });
    });

    describe('#setVerifierAddresses()', () => {
      it('should allow an active validator setting their addresses', async function () {
        await verification.setVerifierAddresses(foo, bar, buzz, { from: bob });

        const bobDetails = await verification.verifiers(bob);
        assert.equal(bobDetails.active, true);
        assert.equal(bobDetails.verificationAddress, foo);
        assert.equal(bobDetails.payoutAddress, bar);
        assert.equal(bobDetails.dataManagementAddress, buzz);
      });

      it('should allow a disabled validator setting their addresses', async function () {
        await verification.setVerifierAddresses(foo, bar, buzz, { from: alice });

        const bobDetails = await verification.verifiers(alice);
        assert.equal(bobDetails.active, false);
        assert.equal(bobDetails.verificationAddress, foo);
        assert.equal(bobDetails.payoutAddress, bar);
        assert.equal(bobDetails.dataManagementAddress, buzz);
      });

      it('should deny non existing verifier setting their addresses', async function () {
        await assertRevert(verification.setVerifierAddresses(foo, bar, buzz, { from: george }));
      });
    });

    describe('#submitTransaction()', () => {
      let data;
      const memberId1 = keccak256('memberId1');

      beforeEach(async function () {
        await verification.setVerifierAddresses(aliceVerification, bar, buzz, { from: alice });
        await verification.setVerifierAddresses(bobVerification, bar, buzz, { from: bob });
        data = dist.contract.methods.addMember(memberId1, eve).encodeABI();
      });

      it('should allow an active verifier submitting tx', async function () {
        await verification.submitTransaction(dist.address, 0, data, bob, { from: bobVerification });

        assert.equal(await verification.transactionCount(), 1);
        assert.equal(await verification.confirmations(0, bob), true);
        assert.equal(await verification.confirmations(0, bobVerification), false);

        const tx0 = await verification.transactions(0);

        assert.equal(tx0.destination, dist.address);
        assert.equal(tx0.value, 0);
        assert.equal(tx0.data, data);
        assert.equal(tx0.executed, false);
      });

      it('should deny an active submitting tx using root key', async function () {
        await assertRevert(
          verification.submitTransaction(dist.address, 0, data, bob, { from: bob }),
          'YALLVerification: Invalid address pair for verification'
        );
      });

      it('should deny a disabled verifier submitting tx', async function () {
        await assertRevert(
          verification.submitTransaction(dist.address, 0, data, alice, { from: aliceVerification }),
          'YALLVerification: Invalid address pair for verification'
        );
      });
    });

    describe('#confirmTransaction()', () => {
      let data;
      const memberId1 = keccak256('memberId1');

      beforeEach(async function () {
        await verification.setVerifierAddresses(aliceVerification, bar, buzz, { from: alice });
        await verification.setVerifierAddresses(bobVerification, bar, buzz, { from: bob });
        await verification.setVerifierAddresses(charlieVerification, bar, buzz, { from: charlie });
        data = dist.contract.methods.addMember(memberId1, eve).encodeABI();
        await verification.submitTransaction(dist.address, 0, data, bob, { from: bobVerification });
      });

      it('should allow an active verifier confirming transaction', async function () {
        await verification.confirmTransaction(0, charlie, { from: charlieVerification });

        assert.equal(await verification.confirmations(0, charlie), true);
        assert.equal(await verification.confirmations(0, charlieVerification), false);
      });

      it('should deny an active verifier confirming tx using a root key', async function () {
        await assertRevert(
          verification.confirmTransaction(0, charlie, { from: charlie }),
          'YALLVerification: Invalid address pair for verification'
        );
      });

      it('should deny a disabled active verifier confirming transaction', async function () {
        await assertRevert(
          verification.confirmTransaction(0, alice, { from: aliceVerification }),
          'YALLVerification: Invalid address pair for verification'
        );
      });
    });

    describe('#revokeConfirmation()', () => {
      let data;
      const memberId1 = keccak256('memberId1');

      beforeEach(async function () {
        await verification.setVerifierAddresses(aliceVerification, bar, buzz, { from: alice });
        await verification.setVerifierAddresses(bobVerification, bar, buzz, { from: bob });
        await verification.setVerifierAddresses(charlieVerification, bar, buzz, { from: charlie });
        data = dist.contract.methods.addMember(memberId1, eve).encodeABI();
        await verification.submitTransaction(dist.address, 0, data, bob, { from: bobVerification });
        await verification.confirmTransaction(0, charlie, { from: charlieVerification });
      });

      it('should allow an active verifier revoking a confirmation', async function () {
        assert.equal(await verification.confirmations(0, charlie), true);
        await verification.revokeConfirmation(0, charlie, { from: charlieVerification });
        assert.equal(await verification.confirmations(0, charlie), false);
      });

      it('should deny an active verifier confirming tx using a root key', async function () {
        await assertRevert(
          verification.revokeConfirmation(0, charlie, { from: charlie }),
          'YALLVerification: Invalid address pair for verification'
        );
      });

      it('should deny a disabled active verifier confirming transaction', async function () {
        await verification.setVerifiers([bob, dan, eve, frank], 3, { from: governance });
        await assertRevert(
          verification.revokeConfirmation(0, charlie, { from: charlieVerification }),
          'YALLVerification: Invalid address pair for verification'
        );
      });
    });

    describe('#executeTransaction()', () => {
      let data;
      const memberId1 = keccak256('memberId1');

      beforeEach(async function () {
        await verification.setVerifierAddresses(aliceVerification, bar, buzz, { from: alice });
        await verification.setVerifierAddresses(bobVerification, bar, buzz, { from: bob });
        await verification.setVerifierAddresses(charlieVerification, bar, buzz, { from: charlie });
        await verification.setVerifierAddresses(danVerification, bar, buzz, { from: dan });
        data = dist.contract.methods.addMember(memberId1, eve).encodeABI();
        await verification.submitTransaction(dist.address, 0, data, bob, { from: bobVerification });
        await verification.confirmTransaction(0, charlie, { from: charlieVerification });
        await registry.setRole(verification.address, await dist.DISTRIBUTOR_VERIFIER_ROLE(), false);
        await verification.confirmTransaction(0, dan, { from: danVerification });
        await registry.setRole(verification.address, await dist.DISTRIBUTOR_VERIFIER_ROLE(), true);
      });

      it('should allow an active verifier revoking a confirmation', async function () {
        assert.equal(await verification.required(), 3);
        assert.equal(await verification.confirmations(0, bob), true);
        assert.equal(await verification.confirmations(0, charlie), true);
        assert.equal(await verification.confirmations(0, dan), true);
        assert.equal((await verification.transactions(0)).executed, false);

        await verification.executeTransaction(0, charlie, { from: charlieVerification });

        assert.equal((await verification.transactions(0)).executed, true);
      });

      it('should deny an active verifier confirming tx using a root key', async function () {
        await assertRevert(
          verification.executeTransaction(0, charlie, { from: charlie }),
          'YALLVerification: Invalid address pair for verification'
        );
      });

      it('should deny a disabled verifier confirming transaction', async function () {
        await assertRevert(
          verification.executeTransaction(0, alice, { from: aliceVerification }),
          'YALLVerification: Invalid address pair for verification'
        );
      });
    });
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
