/*
 * Copyright ©️ 2018-2020 Galt•Project Society Construction and Terraforming Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka)
 *
 * Copyright ©️ 2018-2020 Galt•Core Blockchain Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka) by
 * [Basic Agreement](ipfs/QmaCiXUmSrP16Gz8Jdzq6AJESY1EAANmmwha15uR3c1bsS)).
 */

pragma solidity ^0.5.13;


contract Checkpointable {
  struct Checkpoint {
    uint128 fromBlock;
    uint128 value;
  }

  Checkpoint[] internal _cachedTotalSupply;
  mapping(address => Checkpoint[]) internal _cachedBalances;

  function _updateValueAtNow(Checkpoint[] storage checkpoints, uint256 _value) internal {
    if ((checkpoints.length == 0) || (checkpoints[checkpoints.length - 1].fromBlock < block.number)) {
      Checkpoint storage newCheckPoint = checkpoints[checkpoints.length++];
      newCheckPoint.fromBlock = uint128(block.number);
      newCheckPoint.value = uint128(_value);
    } else {
      Checkpoint storage oldCheckPoint = checkpoints[checkpoints.length - 1];
      oldCheckPoint.value = uint128(_value);
    }
  }

  function _getValueAt(Checkpoint[] storage checkpoints, uint256 _block) internal view returns (uint256) {
    if (checkpoints.length == 0) {
      return 0;
    }

    // Shortcut for the actual value
    if (_block >= checkpoints[checkpoints.length - 1].fromBlock) {
      return checkpoints[checkpoints.length - 1].value;
    }

    if (_block < checkpoints[0].fromBlock) {
      return 0;
    }

    // Binary search of the value in the array
    uint256 min = 0;
    uint256 max = checkpoints.length - 1;
    while (max > min) {
      uint256 mid = (max + min + 1) / 2;
      if (checkpoints[mid].fromBlock <= _block) {
        min = mid;
      } else {
        max = mid - 1;
      }
    }
    return checkpoints[min].value;
  }

  // GETTERS

  function _balanceOfAt(address _address, uint256 _blockNumber) internal view returns (uint256) {
    if ((_cachedBalances[_address].length == 0) || (_cachedBalances[_address][0].fromBlock > _blockNumber)) {
      return 0;
    } else {
      return _getValueAt(_cachedBalances[_address], _blockNumber);
    }
  }

  function _totalSupplyAt(uint256 _blockNumber) internal view returns (uint256) {
    if ((_cachedTotalSupply.length == 0) || (_cachedTotalSupply[0].fromBlock > _blockNumber)) {
      return 0;
    } else {
      return _getValueAt(_cachedTotalSupply, _blockNumber);
    }
  }
}