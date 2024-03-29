const { accounts } = require('@openzeppelin/test-environment');
const { zeroAddress } = require('@galtproject/solidity-test-chest')(web3);
const { assert } = require('chai');
const { buildCoinDistAndExchange } = require('./builders');
const { contract } = require('./twrapper');

const ProxyAdmin = contract.fromArtifact('ProxyAdmin');
const MockRegistryV2 = contract.fromArtifact('MockRegistryV2');
const MockRegistryV3 = contract.fromArtifact('MockRegistryV3');

const bytes32 = web3.utils.utf8ToHex;

async function getProxyAdmin(address) {
  return web3.eth.getStorageAt(address, '0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103');
}

describe('Upgrades', () => {
  const [alice, feeCollector, gsnFeeCollector] = accounts;

  let registryV1;
  let yallToken;

  beforeEach(async function () {
    ({ registry: registryV1, yallToken } = await buildCoinDistAndExchange(alice, {
      feeCollector,
      gsnFeeCollector,
    }));
  });

  it('#should allow a proxy admin owner performing upgrades()', async function () {
    const registryProxyAdminAddress = await getProxyAdmin(registryV1.address);

    assert.notEqual(registryProxyAdminAddress, zeroAddress);

    const proxyAdmin = await ProxyAdmin.at(registryProxyAdminAddress);

    assert.equal(await proxyAdmin.owner(), alice);
    assert.equal(await registryV1.getContract(bytes32('YALL_TOKEN')), yallToken.address);
    assert.throws(() => {
      registryV1.theAnswer();
    }, 'registryV1.theAnswer is not a function');
    assert.throws(() => {
      registryV1.whoAmI();
    }, 'registryV1.whoAmI is not a function');

    // Upgrade to v2
    const v2Implementation = await MockRegistryV2.new();
    await proxyAdmin.upgradeAndCall(
      registryV1.address,
      v2Implementation.address,
      v2Implementation.contract.methods.initialize(42).encodeABI(),
      { from: alice }
    );

    const registryV2 = await MockRegistryV2.at(registryV1.address);

    assert.equal(await registryV2.getContract(bytes32('YALL_TOKEN')), yallToken.address);
    assert.equal(await registryV2.theAnswer(), 42);
    assert.equal(await registryV2.whoAmI(), 'im a mock v2');

    // Upgrade to V3
    const v3Implementation = await MockRegistryV3.new();
    await proxyAdmin.upgrade(registryV1.address, v3Implementation.address, { from: alice });

    const registryV3 = await MockRegistryV3.at(registryV1.address);

    assert.equal(await registryV3.getContract(bytes32('YALL_TOKEN')), yallToken.address);
    assert.equal(await registryV3.theAnswer(), 42);
    assert.equal(await registryV3.whoAmI(), 'im a mock v3');
  });
});
