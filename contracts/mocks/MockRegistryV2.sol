/*
 * Copyright ©️ 2020 Galt•Project Society Construction and Terraforming Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka)
 *
 * Copyright ©️ 2020 Galt•Core Blockchain Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka) by
 * [Basic Agreement](ipfs/QmaCiXUmSrP16Gz8Jdzq6AJESY1EAANmmwha15uR3c1bsS)).
 */

pragma solidity ^0.5.17;

import "../registry/YALLRegistryCore.sol";

contract MockRegistryV2 is YALLRegistryCore {
  uint256 public theAnswer;

  function initialize(uint256 _theAnswer) external {
    theAnswer = _theAnswer;
  }

  function whoAmI() external pure returns (string memory) {
    return "im a mock v2";
  }
}
