/*
 * Copyright ©️ 2020 Galt•Project Society Construction and Terraforming Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka)
 *
 * Copyright ©️ 2020 Galt•Core Blockchain Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka) by
 * [Basic Agreement](ipfs/QmaCiXUmSrP16Gz8Jdzq6AJESY1EAANmmwha15uR3c1bsS)).
 */

const { accounts, contract, defaultSender, web3 } = require('@openzeppelin/test-environment');
const { ether, assertEthBalanceChanged, assertRevert } = require('@galtproject/solidity-test-chest')(web3);

const YALLEthMultiSender = contract.fromArtifact('YALLEthMultiSender');
YALLEthMultiSender.numberFormat = 'String';

describe('YALLEthMultiSender Unit tests', () => {
  const [alice, bob, charlie] = accounts;
  let multiSender;

  before(async function () {
    multiSender = await YALLEthMultiSender.new();
  });

  it('should send values to 3 attached members', async function () {
    const aliceBalanceBefore = await web3.eth.getBalance(alice);
    const bobBalanceBefore = await web3.eth.getBalance(bob);
    const charlieBalanceBefore = await web3.eth.getBalance(charlie);

    await multiSender.sendMultiple([alice, bob, charlie], [ether(1), ether(2), ether(3)], {
      from: defaultSender,
      value: ether(6),
    });

    const aliceBalanceAfter = await web3.eth.getBalance(alice);
    const bobBalanceAfter = await web3.eth.getBalance(bob);
    const charlieBalanceAfter = await web3.eth.getBalance(charlie);

    assertEthBalanceChanged(aliceBalanceBefore, aliceBalanceAfter, ether(1));
    assertEthBalanceChanged(bobBalanceBefore, bobBalanceAfter, ether(2));
    assertEthBalanceChanged(charlieBalanceBefore, charlieBalanceAfter, ether(3));
  });

  it('should reject if approve/reject differs', async function () {
    await assertRevert(
      multiSender.sendMultiple([alice, bob], [1, 2, 3], {
        from: defaultSender,
        value: 6,
      }),
      '_tos & _amounts lengths should match'
    );
  });

  it('should reject if attached msg.value is greater than the accumulated from amounts', async function () {
    await assertRevert(
      multiSender.sendMultiple([alice, bob, charlie], [1, 2, 3], {
        from: defaultSender,
        value: 7,
      }),
      "Attached and distributed values don't match"
    );
  });

  it('should reject without message if attached value is less than the accumulated from amounts', async function () {
    await assertRevert(
      multiSender.sendMultiple([alice, bob, charlie], [1, 2, 3], {
        from: defaultSender,
        value: 5,
      }),
      ''
    );
  });
});
