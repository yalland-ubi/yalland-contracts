/*
 * Copyright ©️ 2020 Galt•Project Society Construction and Terraforming Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka)
 *
 * Copyright ©️ 2020 Galt•Core Blockchain Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka) by
 * [Basic Agreement](ipfs/QmaCiXUmSrP16Gz8Jdzq6AJESY1EAANmmwha15uR3c1bsS)).
 */

const { accounts } = require('@openzeppelin/test-environment');
// eslint-disable-next-line import/order
const { contract } = require('../twrapper');
const { assert } = require('chai');

const YALLTokenEthereum = contract.fromArtifact('YALLTokenEthereum');

YALLTokenEthereum.numberFormat = 'String';

const { ether, assertRevert, zeroAddress } = require('@galtproject/solidity-test-chest')(web3);

describe('YALLTokenEthereum Unit tests', () => {
  const [minter, alice, bob] = accounts;
  let yallTokenEthereum;

  beforeEach(async function () {
    yallTokenEthereum = await YALLTokenEthereum.new();
  });

  describe('Owner Interface', () => {
    describe('#setMinter()', async function () {
      it('should allow an owner setting minterAddress', async function () {
        assert.equal(await yallTokenEthereum.minter(), zeroAddress);
        await yallTokenEthereum.setMinter(alice);
        assert.equal(await yallTokenEthereum.minter(), alice);
      });

      it('should deny non-owner setting minterAddress', async function () {
        await assertRevert(yallTokenEthereum.setMinter(alice, { from: alice }), 'Ownable: caller is not the own');
      });
    });
  });

  describe('Minter Interface', () => {
    beforeEach(async function () {
      await yallTokenEthereum.setMinter(minter);
    });

    describe('#mint()', async function () {
      it('should allow a minter minting new tokens', async function () {
        assert.equal(await yallTokenEthereum.totalSupply(), 0);
        assert.equal(await yallTokenEthereum.balanceOf(bob), 0);

        await yallTokenEthereum.mint(bob, ether(42), { from: minter });

        assert.equal(await yallTokenEthereum.totalSupply(), ether(42));
        assert.equal(await yallTokenEthereum.balanceOf(bob), ether(42));
      });

      it('should deny non-minter minting tokens', async function () {
        await assertRevert(yallTokenEthereum.mint(bob, ether(42)), 'YALLTokenEthereum: Only minter allowed');
      });
    });

    describe('#burn()', async function () {
      beforeEach(async function () {
        await yallTokenEthereum.mint(alice, ether(42), { from: minter });
      });

      it('should a token holder burnign his tokens', async function () {
        assert.equal(await yallTokenEthereum.totalSupply(), ether(42));
        assert.equal(await yallTokenEthereum.balanceOf(alice), ether(42));

        await yallTokenEthereum.burn(ether(41), { from: alice });

        assert.equal(await yallTokenEthereum.totalSupply(), ether(1));
        assert.equal(await yallTokenEthereum.balanceOf(alice), ether(1));
      });
    });
  });
});
