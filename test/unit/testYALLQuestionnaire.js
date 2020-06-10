const { accounts, defaultSender } = require('@openzeppelin/test-environment');
// eslint-disable-next-line import/order
const { contract } = require('../twrapper');
const { assert } = require('chai');
const {
  ether,
  increaseTime,
  assertErc20BalanceChanged,
  assertRevert,
  getEventArg,
  now,
} = require('@galtproject/solidity-test-chest')(web3);

const { buildCoinDistAndExchange } = require('../builders');

const YALLQuestionnaire = contract.fromArtifact('YALLQuestionnaire');
YALLQuestionnaire.numberFormat = 'String';

const keccak256 = web3.utils.soliditySha3;

describe('YALLQuestionnaire Unit tests', () => {
  const [
    alice,
    bob,
    charlie,
    dan,
    distributorVerifier,
    yallMinter,
    yallTokenManager,
    feeCollector,
    gsnFeeCollector,
  ] = accounts;
  let registry;
  let dist;
  let questionnaire;
  let yallToken;
  const aliceId = keccak256('member1');
  const bobId = keccak256('member2');
  const charlieId = keccak256('member3');
  const danId = keccak256('member4');

  before(async function () {
    ({ registry, yallToken, dist } = await buildCoinDistAndExchange(defaultSender, {
      feeCollector,
      gsnFeeCollector,
      yallTokenManager,
      yallMinter,
      distributorVerifier,
      disableExchange: true,
      disableVerification: true,
      disableEmission: true,
      disableCommission: true,
    }));

    questionnaire = await YALLQuestionnaire.new();
    await questionnaire.initialize(registry.address);

    await dist.addMembersBeforeGenesis([aliceId, bobId, charlieId, danId], [alice, bob, charlie, dan], {
      from: distributorVerifier,
    });
    await increaseTime(21);
    await dist.disableMembers([bob], { from: distributorVerifier });
    await yallToken.setCanTransferWhitelistAddress(bob, true, { from: yallTokenManager });
    await yallToken.setCanTransferWhitelistAddress(questionnaire.address, true, { from: yallTokenManager });
    await yallToken.setNoTransferFeeWhitelistAddress(questionnaire.address, true, { from: yallTokenManager });
    await yallToken.mint(alice, ether(10000), { from: yallMinter });
    await yallToken.mint(bob, ether(10000), { from: yallMinter });
  });

  describe('#createQuestionnaire()', async function () {
    let activeTill;

    beforeEach(async function () {
      activeTill = (await now()) + 3600;
    });

    it('should send values to 3 attached members', async function () {
      await yallToken.approve(questionnaire.address, ether(30), { from: alice });
      const res = await questionnaire.createQuestionnaire(activeTill, ether(30), ether(2), 'buzz', { from: alice });
      const qId = getEventArg(res, 'CreateQuestionnaire', 'questionnaireId');

      const details = await questionnaire.questionnaires(qId);
      assert.equal(details.stopped, false);
      assert.equal(details.details, 'buzz');
      assert.equal(details.activeTill, activeTill);
      assert.equal(details.deposit, ether(30));
      assert.equal(details.reward, ether(2));
    });

    it('should deny a disabled member creating questionnaire', async function () {
      await yallToken.approve(questionnaire.address, ether(30), { from: bob });
      await assertRevert(
        questionnaire.createQuestionnaire(activeTill, ether(30), ether(2), 'buzz', { from: bob }),
        'YALLQuestionnaire: Member is inactive'
      );
    });

    it('should deny creating a questionnaire without a reward', async function () {
      await yallToken.approve(questionnaire.address, ether(30), { from: alice });
      await assertRevert(
        questionnaire.createQuestionnaire(activeTill, ether(30), 0, 'buzz', { from: alice }),
        'YALLQuestionnaire: Reward should be greater than 0'
      );
    });

    it('should deny creating a questionnaire with a deposit less than a reward', async function () {
      await yallToken.approve(questionnaire.address, ether(30), { from: alice });
      await assertRevert(
        questionnaire.createQuestionnaire(activeTill, ether(2), ether(3), 'buzz', { from: alice }),
        'YALLQuestionnaire: Insufficient deposit'
      );
    });

    it('should deny creating a questionnaire a activeTill earlier than now', async function () {
      activeTill = (await now()) - 10;
      await yallToken.approve(questionnaire.address, ether(30), { from: alice });
      await assertRevert(
        questionnaire.createQuestionnaire(activeTill, ether(30), ether(3), 'buzz', { from: alice }),
        'YALLQuestionnaire: Invalid activeTill'
      );
    });
  });

  describe('#stopQuestionnaire()', async function () {
    let activeTill;
    let qId;

    beforeEach(async function () {
      activeTill = (await now()) + 3600;
      await yallToken.approve(questionnaire.address, ether(30), { from: alice });
      const res = await questionnaire.createQuestionnaire(activeTill, ether(30), ether(2), 'buzz', { from: alice });
      qId = getEventArg(res, 'CreateQuestionnaire', 'questionnaireId');
    });

    it('should allow a creator stopping questionnaire', async function () {
      await questionnaire.stopQuestionnaire(qId, { from: alice });

      const details = await questionnaire.questionnaires(qId);
      assert.equal(details.stopped, true);
    });

    it('should deny another address stopping questionnaire', async function () {
      await assertRevert(
        questionnaire.stopQuestionnaire(qId, { from: bob }),
        'YALLQuestionnaire: Only creator allowed'
      );
    });

    it('should deny stopping questionnaire twice', async function () {
      await questionnaire.stopQuestionnaire(qId, { from: alice });
      await assertRevert(questionnaire.stopQuestionnaire(qId, { from: alice }), 'YALLQuestionnaire: Already stopped');
    });
  });

  describe('#increaseDeposit()', async function () {
    let activeTill;
    let qId;

    beforeEach(async function () {
      activeTill = (await now()) + 3600;
      await yallToken.approve(questionnaire.address, ether(30), { from: alice });
      const res = await questionnaire.createQuestionnaire(activeTill, ether(30), ether(2), 'buzz', { from: alice });
      qId = getEventArg(res, 'CreateQuestionnaire', 'questionnaireId');
    });

    it('should allow a creator increasing deposit questionnaire', async function () {
      await yallToken.approve(questionnaire.address, ether(20), { from: alice });
      await questionnaire.increaseDeposit(qId, ether(20), { from: alice });

      const details = await questionnaire.questionnaires(qId);
      assert.equal(details.deposit, ether(50));
    });

    it('should deny a creator increasing deposit for a stopped questionnaire', async function () {
      await questionnaire.stopQuestionnaire(qId, { from: alice });
      await yallToken.approve(questionnaire.address, ether(20), { from: alice });
      await assertRevert(
        questionnaire.increaseDeposit(qId, ether(20), { from: alice }),
        'YALLQuestionnaire: Already stopped'
      );
    });

    it('should deny a creator increasing deposit for a non active questionnaire', async function () {
      await increaseTime(3700);
      await yallToken.approve(questionnaire.address, ether(20), { from: alice });
      await assertRevert(
        questionnaire.increaseDeposit(qId, ether(20), { from: alice }),
        'YALLQuestionnaire: Not active'
      );
    });
  });

  describe('#withdrawDeposit()', async function () {
    let activeTill;
    let qId;

    beforeEach(async function () {
      activeTill = (await now()) + 3600;
      await yallToken.approve(questionnaire.address, ether(30), { from: alice });
      const res = await questionnaire.createQuestionnaire(activeTill, ether(30), ether(2), 'buzz', { from: alice });
      qId = getEventArg(res, 'CreateQuestionnaire', 'questionnaireId');
    });

    it('should deny a creator withdrawing deposit for an active and non stopped questionnaire', async function () {
      await assertRevert(
        questionnaire.withdrawDeposit(qId, bob, { from: alice }),
        'YALLQuestionnaire: Still active or not stopped'
      );
    });

    it('should allow a creator withdrawing a deposit for a stopped questionnaire', async function () {
      await questionnaire.stopQuestionnaire(qId, { from: alice });

      const bobBalanceBefore = await yallToken.balanceOf(bob);
      await questionnaire.withdrawDeposit(qId, bob, { from: alice });
      const bobBalanceAfter = await yallToken.balanceOf(bob);

      assertErc20BalanceChanged(bobBalanceBefore, bobBalanceAfter, ether(30));

      const details = await questionnaire.questionnaires(qId);
      assert.equal(details.deposit, ether(0));
    });

    it('should allow a creator withdrawing a deposit for a non active questionnaire', async function () {
      await increaseTime(3700);

      const bobBalanceBefore = await yallToken.balanceOf(bob);
      await questionnaire.withdrawDeposit(qId, bob, { from: alice });
      const bobBalanceAfter = await yallToken.balanceOf(bob);

      assertErc20BalanceChanged(bobBalanceBefore, bobBalanceAfter, ether(30));

      const details = await questionnaire.questionnaires(qId);
      assert.equal(details.deposit, 0);
    });
  });

  describe('#submitAnswers()', async function () {
    let activeTill;
    let qId;
    const answers = [keccak256('foo'), keccak256('bar'), keccak256('buzz')];

    beforeEach(async function () {
      activeTill = (await now()) + 3600;
      await yallToken.approve(questionnaire.address, ether(30), { from: alice });
      const res = await questionnaire.createQuestionnaire(activeTill, ether(30), ether(12), 'buzz', { from: alice });
      qId = getEventArg(res, 'CreateQuestionnaire', 'questionnaireId');
    });

    it('should allow an active member submitting answers', async function () {
      const charlieBalanceBefore = await yallToken.balanceOf(charlie);
      await questionnaire.submitAnswers(qId, answers, { from: charlie });
      const charlieBalanceAfter = await yallToken.balanceOf(charlie);

      assertErc20BalanceChanged(charlieBalanceBefore, charlieBalanceAfter, ether(12));
    });

    it('should deny a disabled member submitting answers', async function () {
      await assertRevert(
        questionnaire.submitAnswers(qId, answers, { from: bob }),
        'YALLQuestionnaire: Member is inactive'
      );
    });

    it('should deny an active member submitting answers if there is no deposit left for a reward', async function () {
      assert.equal((await questionnaire.questionnaires(qId)).submissionCount, 0);
      await questionnaire.submitAnswers(qId, answers, { from: alice });
      assert.equal((await questionnaire.questionnaires(qId)).submissionCount, 1);
      await questionnaire.submitAnswers(qId, answers, { from: dan });
      assert.equal((await questionnaire.questionnaires(qId)).submissionCount, 2);
      await assertRevert(
        questionnaire.submitAnswers(qId, answers, { from: charlie }),
        'YALLQuestionnaire: Insufficient funds for a reward'
      );
    });

    it('should deny an active member submitting answers twice', async function () {
      await questionnaire.submitAnswers(qId, answers, { from: charlie });
      await assertRevert(
        questionnaire.submitAnswers(qId, answers, { from: charlie }),
        'YALLQuestionnaire: Already submitted'
      );
    });

    it('should deny an active member submitting answers for a stopped questionnaire', async function () {
      await questionnaire.stopQuestionnaire(qId, { from: alice });
      await assertRevert(
        questionnaire.submitAnswers(qId, answers, { from: charlie }),
        'YALLQuestionnaire: Already stopped'
      );
    });

    it('should deny an active member submitting answers for an inactive questionnaire', async function () {
      await increaseTime(3700);
      await assertRevert(questionnaire.submitAnswers(qId, answers, { from: charlie }), 'YALLQuestionnaire: Not active');
    });
  });

  describe('getters', async function () {
    let activeTill;
    let qId;
    const answers = [keccak256('foo'), keccak256('bar'), keccak256('buzz')];

    beforeEach(async function () {
      activeTill = (await now()) + 3600;
      await yallToken.approve(questionnaire.address, ether(30), { from: alice });
      const res = await questionnaire.createQuestionnaire(activeTill, ether(30), ether(12), 'buzz', { from: alice });
      qId = getEventArg(res, 'CreateQuestionnaire', 'questionnaireId');
    });

    it('should calculate remaining slots', async function () {
      assert.equal(await questionnaire.getRemainingSubmissionSlots(qId), 2);
      await questionnaire.submitAnswers(qId, answers, { from: charlie });
      assert.equal(await questionnaire.getRemainingSubmissionSlots(qId), 1);
      await questionnaire.submitAnswers(qId, answers, { from: alice });
      assert.equal(await questionnaire.getRemainingSubmissionSlots(qId), 0);
      await yallToken.approve(questionnaire.address, ether(6), { from: alice });
      await questionnaire.increaseDeposit(qId, ether(6), { from: alice });
      assert.equal(await questionnaire.getRemainingSubmissionSlots(qId), 1);
      await questionnaire.submitAnswers(qId, answers, { from: dan });
      assert.equal(await questionnaire.getRemainingSubmissionSlots(qId), 0);
    });

    it('should return submitted answers', async function () {
      assert.sameMembers(await questionnaire.getSubmittedAnswers(qId, charlieId), []);
      await questionnaire.submitAnswers(qId, answers, { from: charlie });
      assert.sameMembers(await questionnaire.getSubmittedAnswers(qId, charlieId), answers);
    });
  });
});
