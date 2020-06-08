let hook;
global.before = function (_hook) {
  hook = _hook;
};
const { accounts, contract, defaultSender } = require('@openzeppelin/test-environment');
const assert = require('assert');
// eslint-disable-next-line import/order
// const { contract } = require('../test/twrapper');
const { buildCoinDistAndExchange, deployWithProxy } = require('../test/builders');
const benchmark = require('../benchmark');

// eslint-disable-next-line import/order
const { getEventArg, ether } = require('@galtproject/solidity-test-chest')(web3);

const keccak256 = web3.utils.soliditySha3;

const YALLToken = contract.fromArtifact('YALLToken');
const YALLVerification = contract.fromArtifact('YALLVerification');
const Mock = contract.fromArtifact('MockRegistryV2');
const ERC20Managed = contract.fromArtifact('ERC20Managed');

YALLToken.numberFormat = 'String';
ERC20Managed.numberFormat = 'String';

const [alice, bob, charlie, distributorVerifier, feeManager, yallMinter, yallTokenManager, governance] = accounts;

const memberId1 = keccak256('alice');
const memberId2 = keccak256('bob');
const memberId3 = keccak256('charlie');

benchmark(() => {
  let yallToken;
  let dist;
  let registry;
  let proxyAdmin;
  let verification;
  let feeCollector;
  let gsnFeeCollector;

  before(async function () {
    hook();
    feeCollector = (await Mock.new()).address;
    gsnFeeCollector = (await Mock.new()).address;
    ({ yallToken, dist, registry, verification, proxyAdmin } = await buildCoinDistAndExchange(defaultSender, {
      distributorVerifier,
      feeManager,
      yallMinter,
      yallTokenManager,
      feeCollector,
      gsnFeeCollector,
      governance,
    }));
    await dist.addMembersBeforeGenesis([memberId1, memberId2, memberId3], [alice, bob, charlie], {
      from: distributorVerifier,
    });
  });

  beforeEach(async function () {
    yallToken = await YALLToken.new(registry.address, 'Coin token', 'COIN', 18);
    await registry.setContract(await registry.YALL_TOKEN_KEY(), yallToken.address);
    await yallToken.mint(alice, ether(100), { from: yallMinter });
    await yallToken.setCanTransferWhitelistAddress(feeCollector, true, { from: yallTokenManager });
    await yallToken.setTransferFee(ether('0.02'), { from: feeManager });
    await registry.setContract(await registry.YALL_FEE_COLLECTOR_KEY(), feeCollector);
  });

  describe('#transfer() (gross)', function () {
    run('for beneficiary with 0 balance / fee collector balance is 0', async function () {
      assert.equal(await yallToken.balanceOf(feeCollector), 0);
      return yallToken.transfer(bob, ether(20), { from: alice });
    });

    run('for beneficiary with non-0 balance / fee collector balance is 0', async function () {
      await yallToken.mint(bob, 20, { from: yallMinter });
      await yallToken.transfer(feeCollector, ether(20), { from: alice });
      return yallToken.transfer(bob, ether(20), { from: alice });
    });

    run('for beneficiary with non-0 balance / fee collector balance non-0', async function () {
      assert.equal(await yallToken.balanceOf(feeCollector), 0);
      await yallToken.transfer(bob, ether(20), { from: alice });
      await yallToken.transfer(feeCollector, ether(20), { from: alice });
      return yallToken.transfer(bob, ether(20), { from: alice });
    });
  });

  describe('#transferFrom() for users (gross)', function () {
    run('for beneficiary with 0 balance, beneficiary is msg.sender', async function () {
      await yallToken.approve(bob, ether(20), { from: alice });
      assert.equal(await yallToken.balanceOf(bob), 0);
      return yallToken.transferFrom(alice, bob, ether(10), { from: bob });
    });

    run('for beneficiary with 0 balance, beneficiary is not msg.sender', async function () {
      await yallToken.mint(bob, ether(20), { from: yallMinter });
      await yallToken.approve(bob, ether(20), { from: alice });
      assert.equal(await yallToken.balanceOf(charlie), 0);
      assert.equal(await yallToken.balanceOf(feeCollector), 0);
      return yallToken.transferFrom(alice, charlie, ether(10), { from: bob });
    });
  });

  describe('#transferFrom() for WL contracts (net)', function () {
    run('for beneficiary with 0 balance / beneficiary is msg.sender / collector balance is 0', async function () {
      const c1 = await ERC20Managed.new(yallToken.address);
      await yallToken.setCanTransferWhitelistAddress(c1.address, true, { from: yallTokenManager });
      await yallToken.approve(c1.address, ether(20), { from: alice });
      const res = await c1.transferFrom(alice, c1.address, ether(10));
      const gasUsed = getEventArg(res, 'GasUsedEvent', 'gasUsed');
      return parseInt(gasUsed, 10);
    });

    run('for beneficiary with 0 balance / beneficiary is msg.sender / collector balance non-0', async function () {
      const c1 = await ERC20Managed.new(yallToken.address);
      await yallToken.mint(feeCollector, ether(10), { from: yallMinter });
      await yallToken.setCanTransferWhitelistAddress(c1.address, true, { from: yallTokenManager });
      await yallToken.approve(c1.address, ether(20), { from: alice });
      assert.equal(await yallToken.balanceOf(feeCollector), ether(10));
      const res = await c1.transferFrom(alice, c1.address, ether(10));
      const gasUsed = getEventArg(res, 'GasUsedEvent', 'gasUsed');
      return parseInt(gasUsed, 10);
    });

    run('for beneficiary with 0 balance / beneficiary is not msg.sender / collector balance is 0', async function () {
      const c0 = await ERC20Managed.new(yallToken.address);
      const c1 = await ERC20Managed.new(yallToken.address);
      const c2 = await ERC20Managed.new(yallToken.address);
      await yallToken.mint(c0.address, ether(20), { from: yallMinter });
      await yallToken.mint(c1.address, ether(20), { from: yallMinter });
      await yallToken.setCanTransferWhitelistAddress(c0.address, true, { from: yallTokenManager });
      await yallToken.setCanTransferWhitelistAddress(c1.address, true, { from: yallTokenManager });
      await yallToken.setCanTransferWhitelistAddress(c2.address, true, { from: yallTokenManager });
      await c0.approve(c1.address, ether(20));
      assert.equal(await yallToken.balanceOf(c2.address), 0);
      assert.equal(await yallToken.balanceOf(feeCollector), 0);
      const res = await c1.transferFrom(c0.address, c2.address, ether(10));
      const gasUsed = getEventArg(res, 'GasUsedEvent', 'gasUsed');
      return parseInt(gasUsed, 10);
    });
  });

  describe('#setVerifiers)', function () {
    beforeEach(async function () {
      const verificationDeployment = await deployWithProxy(YALLVerification, proxyAdmin.address, registry.address);
      verification = verificationDeployment.contract;
      await registry.setContract(await registry.YALL_VERIFICATION_KEY(), verification.address);
    });

    run('set 3 initial verifiers', async function () {
      return verification.setVerifiers([alice, bob, charlie], 2, { from: governance });
    });

    run('set 20 initial verifiers', async function () {
      const initialVerifiers = [];
      for (let i = 0; i < 20; i++) {
        initialVerifiers.push(web3.eth.accounts.create().address);
      }
      return verification.setVerifiers(initialVerifiers, 15, { from: governance });
    });

    run('replace 20 initial verifiers with 20 new', async function () {
      const initialVerifiers = [];
      const newVerifiers = [];
      for (let i = 0; i < 20; i++) {
        initialVerifiers.push(web3.eth.accounts.create().address);
        newVerifiers.push(web3.eth.accounts.create().address);
      }
      await verification.setVerifiers(initialVerifiers, 15, { from: governance });
      return verification.setVerifiers(newVerifiers, 15, { from: governance });
    });
  });
});
