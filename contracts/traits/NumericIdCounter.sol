/*
 * Copyright ©️ 2020 Galt•Project Society Construction and Terraforming Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka)
 *
 * Copyright ©️ 2020 Galt•Core Blockchain Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka) by
 * [Basic Agreement](ipfs/QmaCiXUmSrP16Gz8Jdzq6AJESY1EAANmmwha15uR3c1bsS)).
 */
pragma solidity ^0.5.17;


contract NumericIdCounter {
  uint256 internal _idCounter;

  /**
   * @dev Increment counter by one. Starts from 1.
   */
  function _nextCounterId() internal returns (uint256) {
    return ++_idCounter;
  }
}
