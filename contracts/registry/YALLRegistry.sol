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
  uint256 public constant VERSION = 4;

  bytes32 public constant YALL_TOKEN_KEY = bytes32("YALL_TOKEN");
  bytes32 public constant YALL_DISTRIBUTOR_KEY = bytes32("YALL_DISTRIBUTOR");
  bytes32 public constant YALL_EXCHANGE_KEY = bytes32("YALL_EXCHANGE");
  bytes32 public constant YALL_VERIFICATION_KEY = bytes32("YALL_VERIFICATION");
  bytes32 public constant YALL_COMMISSION_REWARD_POOL_KEY = bytes32("YALL_COMMISSION_REWARD_POOL");
  bytes32 public constant YALL_EMISSION_REWARD_POOL_KEY = bytes32("YALL_EMISSION_REWARD_POOL");
  bytes32 public constant YALL_HOME_MEDIATOR_KEY = bytes32("YALL_HOME_MEDIATOR");
  bytes32 public constant YALL_FEE_COLLECTOR_KEY = bytes32("YALL_FEE_COLLECTOR");

  // GET WRAPPERS
  function getContracts2(bytes32 _key1, bytes32 _key2) external view returns (address, address) {
    return (contracts[_key1], contracts[_key2]);
  }

  function getContracts3(bytes32 _key1, bytes32 _key2, bytes32 _key3) external view returns (address, address, address) {
    return (contracts[_key1], contracts[_key2], contracts[_key3]);
  }

  function getContractSafu(bytes32 _key) external view returns (address) {
    address addr = contracts[_key];
    require(addr != ZERO_ADDRESS, "YALLRegistry: contract not set");
    return (addr);
  }

  function getContractsSafu2(bytes32 _key1, bytes32 _key2) public view returns (address, address) {
    address addr1 = contracts[_key1];
    address addr2 = contracts[_key2];
    require(addr1 != ZERO_ADDRESS && addr2 != ZERO_ADDRESS, "YALLRegistry: contract not set");
    return (addr1, addr2);
  }

  function getContractsSafu3(bytes32 _key1, bytes32 _key2, bytes32 _key3) external view returns (address, address, address) {
    address addr1 = contracts[_key1];
    address addr2 = contracts[_key2];
    address addr3 = contracts[_key3];
    require(addr1 != ZERO_ADDRESS && addr2 != ZERO_ADDRESS && addr3 != ZERO_ADDRESS, "YALLRegistry: contract not set");
    return (addr1, addr2, addr3);
  }

  // NAMED GETTERS
  function getYallTokenAddress() external view returns (address) {
    require(contracts[YALL_TOKEN_KEY] != ZERO_ADDRESS, "YALLRegistry: YALL_TOKEN not set");
    return contracts[YALL_TOKEN_KEY];
  }

  function getYallDistributorAddress() external view returns (address) {
    require(contracts[YALL_DISTRIBUTOR_KEY] != ZERO_ADDRESS, "YALLRegistry: YALL_DISTRIBUTOR not set");
    return contracts[YALL_DISTRIBUTOR_KEY];
  }

  function getYallExchangeAddress() external view returns (address) {
    require(contracts[YALL_EXCHANGE_KEY] != ZERO_ADDRESS, "YALLRegistry: YALL_EXCHANGE not set");
    return contracts[YALL_EXCHANGE_KEY];
  }

  function getYallVerificationAddress() external view returns (address) {
    require(contracts[YALL_VERIFICATION_KEY] != ZERO_ADDRESS, "YALLRegistry: YALL_VERIFICATION not set");
    return contracts[YALL_VERIFICATION_KEY];
  }

  function getYallCommissionRewardPoolAddress() external view returns (address) {
    require(contracts[YALL_COMMISSION_REWARD_POOL_KEY] != ZERO_ADDRESS, "YALLRegistry: YALL_COMMISSION_REWARD_POOL not set");
    return contracts[YALL_COMMISSION_REWARD_POOL_KEY];
  }

  function getYallEmissionRewardPoolAddress() external view returns (address) {
    require(contracts[YALL_EMISSION_REWARD_POOL_KEY] != ZERO_ADDRESS, "YALLRegistry: YALL_EMISSION_REWARD_POOL not set");
    return contracts[YALL_EMISSION_REWARD_POOL_KEY];
  }

  function getYallHomeMediatorAddress() external view returns (address) {
    require(contracts[YALL_HOME_MEDIATOR_KEY] != ZERO_ADDRESS, "YALLRegistry: YALL_HOME_MEDIATOR not set");
    return contracts[YALL_HOME_MEDIATOR_KEY];
  }

  function getYallFeeCollectorAddress() external view returns (address) {
    require(contracts[YALL_FEE_COLLECTOR_KEY] != ZERO_ADDRESS, "YALLRegistry: YALL_FEE_COLLECTOR not set");
    return contracts[YALL_FEE_COLLECTOR_KEY];
  }

  // NAMED COMBINED GETTERS
  function getYallDistributorAndFeeCollectorAddress() external view returns (address, address) {
    return getContractsSafu2(YALL_DISTRIBUTOR_KEY, YALL_FEE_COLLECTOR_KEY);
  }

  function getYallTokenAndFeeCollectorAddress() external view returns (address, address) {
    return getContractsSafu2(YALL_TOKEN_KEY, YALL_FEE_COLLECTOR_KEY);
  }
}
