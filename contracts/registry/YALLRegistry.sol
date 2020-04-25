/*
 * Copyright ©️ 2020 Galt•Project Society Construction and Terraforming Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka)
 *
 * Copyright ©️ 2020 Galt•Core Blockchain Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka) by
 * [Basic Agreement](ipfs/QmaCiXUmSrP16Gz8Jdzq6AJESY1EAANmmwha15uR3c1bsS)).
 */

pragma solidity ^0.5.13;

import "./YALLRegistryCore.sol";

/**
 * @title YALLRegistry contract
 * @author Galt Project
 * @notice Contract address and ACL registry
 **/
contract YALLRegistry is YALLRegistryCore {
  uint256 public constant VERSION = 3;

  bytes32 public constant YALL_TOKEN_KEY = bytes32("yall_token");
  bytes32 public constant YALL_DISTRIBUTOR_KEY = bytes32("yall_distributor");
  bytes32 public constant YALL_EXCHANGE_KEY = bytes32("yall_exchange");

  function getYallTokenAddress() public view returns (address) {
    require(contracts[YALL_TOKEN_KEY] != ZERO_ADDRESS, "YALLRegistry: YALL_TOKEN_KEY not set");
    return contracts[YALL_TOKEN_KEY];
  }

  function getYallDistributorAddress() external view returns (address) {
    require(contracts[YALL_DISTRIBUTOR_KEY] != ZERO_ADDRESS, "YALLRegistry: YALL_DISTRIBUTOR_KEY not set");
    return contracts[YALL_DISTRIBUTOR_KEY];
  }
}
