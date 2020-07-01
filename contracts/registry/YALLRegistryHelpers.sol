/*
 * Copyright ©️ 2020 Galt•Project Society Construction and Terraforming Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka)
 *
 * Copyright ©️ 2020 Galt•Core Blockchain Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka) by
 * [Basic Agreement](ipfs/QmaCiXUmSrP16Gz8Jdzq6AJESY1EAANmmwha15uR3c1bsS)).
 */

pragma solidity ^0.5.17;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "erc20-staking-contracts/contracts/interfaces/IStakingHomeMediator.sol";
import "./YALLRegistry.sol";
import "../interfaces/IYALLDistributor.sol";
import "../interfaces/IYALLToken.sol";
import "../interfaces/IYALLVerification.sol";

/**
 * @title YALLRegistry contract
 * @author Galt Project
 * @notice Contains exposed system role constants, modifiers and getters for registered contracts.
 **/
contract YALLRegistryHelpers {
  YALLRegistry public yallRegistry;

  // Common Role Constants
  bytes32 public constant GOVERNANCE_ROLE = bytes32("GOVERNANCE");
  bytes32 public constant FEE_CLAIMER_ROLE = bytes32("FEE_CLAIMER");
  bytes32 public constant FEE_MANAGER_ROLE = bytes32("FEE_MANAGER");
  bytes32 public constant PAUSER_ROLE = bytes32("PAUSER");
  // YALLToken Role Constants
  bytes32 public constant YALL_TOKEN_MINTER_ROLE = bytes32("YALL_TOKEN_MINTER");
  bytes32 public constant YALL_TOKEN_BURNER_ROLE = bytes32("YALL_TOKEN_BURNER");
  bytes32 public constant YALL_TOKEN_MANAGER_ROLE = bytes32("YALL_TOKEN_MANAGER");
  // YALLDistributor Role Constants
  bytes32 public constant DISTRIBUTOR_MANAGER_ROLE = bytes32("DISTRIBUTOR_MANAGER");
  bytes32 public constant DISTRIBUTOR_VERIFIER_ROLE = bytes32("DISTRIBUTOR_VERIFIER");
  bytes32 public constant DISTRIBUTOR_EMISSION_CLAIMER_ROLE = bytes32("DISTRIBUTOR_EMISSION_CLAIMER");
  // YALLExchange Role Constants
  bytes32 public constant EXCHANGE_MANAGER_ROLE = bytes32("EXCHANGE_MANAGER");
  bytes32 public constant EXCHANGE_OPERATOR_ROLE = bytes32("EXCHANGE_OPERATOR");
  bytes32 public constant EXCHANGE_SUPER_OPERATOR_ROLE = bytes32("EXCHANGE_SUPER_OPERATOR");
  // YALLEmissionRewardPool Role Constants
  bytes32 public constant EMISSION_POOL_MANAGER_ROLE = bytes32("EMISSION_POOL_MANAGER");
  // YALLCommissionRewardPool Role Constants
  bytes32 public constant COMMISSION_POOL_MANAGER_ROLE = bytes32("COMMISSION_POOL_MANAGER");

  // Common Role Checkers

  modifier onlyGovernance() {
    require(yallRegistry.hasRole(msg.sender, GOVERNANCE_ROLE), "YALLHelpers: Only GOVERNANCE allowed");
    _;
  }

  modifier onlyFeeClaimer() {
    require(yallRegistry.hasRole(msg.sender, FEE_CLAIMER_ROLE), "YALLHelpers: Only FEE_CLAIMER allowed");
    _;
  }

  modifier onlyFeeManager() {
    require(yallRegistry.hasRole(msg.sender, FEE_MANAGER_ROLE), "YALLHelpers: Only FEE_MANAGER allowed");
    _;
  }

  modifier onlyPauser() {
    require(yallRegistry.hasRole(msg.sender, PAUSER_ROLE), "YALLHelpers: Only PAUSER allowed");
    _;
  }

  // YALLToken Role Checkers

  modifier onlyMinter() {
    require(yallRegistry.hasRole(msg.sender, YALL_TOKEN_MINTER_ROLE), "YALLToken: Only YALL_TOKEN_MINTER allowed");
    _;
  }

  modifier onlyBurner() {
    require(yallRegistry.hasRole(msg.sender, YALL_TOKEN_BURNER_ROLE), "YALLToken: Only YALL_TOKEN_BURNER allowed");
    _;
  }

  modifier onlyYallTokenManager() {
    require(yallRegistry.hasRole(msg.sender, YALL_TOKEN_MANAGER_ROLE), "YALLToken: Only YALL_TOKEN_MANAGER allowed");
    _;
  }

  // YALLDistributor Role Checkers

  modifier onlyDistributorManager() {
    require(
      yallRegistry.hasRole(msg.sender, DISTRIBUTOR_MANAGER_ROLE),
      "YALLDistributor: Only DISTRIBUTOR_MANAGER allowed"
    );

    _;
  }

  modifier onlyDistributorVerifier() {
    require(
      yallRegistry.hasRole(msg.sender, DISTRIBUTOR_VERIFIER_ROLE),
      "YALLDistributor: Only DISTRIBUTOR_VERIFIER allowed"
    );
    _;
  }

  modifier onlyDistributorEmissionClaimer() {
    require(
      yallRegistry.hasRole(msg.sender, DISTRIBUTOR_EMISSION_CLAIMER_ROLE),
      "YALLDistributor: Only DISTRIBUTOR_EMISSION_CLAIMER allowed"
    );

    _;
  }

  // YALLExchange Role Checkers

  modifier onlyExchangeFundManager() {
    require(yallRegistry.hasRole(msg.sender, EXCHANGE_MANAGER_ROLE), "YALLExchange: Only EXCHANGE_MANAGER allowed");
    _;
  }

  modifier onlyExchangeOperator() {
    require(yallRegistry.hasRole(msg.sender, EXCHANGE_OPERATOR_ROLE), "YALLExchange: Only EXCHANGE_OPERATOR allowed");
    _;
  }

  modifier onlyExchangeSuperOperator() {
    require(
      yallRegistry.hasRole(msg.sender, EXCHANGE_SUPER_OPERATOR_ROLE),
      "YALLExchange: Only EXCHANGE_SUPER_OPERATOR allowed"
    );
    _;
  }

  // YALLEmissionRewardPool Role Checkers

  modifier onlyEmissionRewardPoolManager() {
    require(
      yallRegistry.hasRole(msg.sender, EMISSION_POOL_MANAGER_ROLE),
      "YALLHelpers: Only EMISSION_POOL_MANAGER allowed"
    );
    _;
  }

  // YALLCommissionRewardPool Role Checkers

  modifier onlyCommissionRewardPoolManager() {
    require(
      yallRegistry.hasRole(msg.sender, COMMISSION_POOL_MANAGER_ROLE),
      "YALLHelpers: Only COMMISSION_POOL_MANAGER allowed"
    );
    _;
  }

  // CONTRACT GETTERS

  function _yallTokenAddress() internal view returns (address) {
    return yallRegistry.getYallTokenAddress();
  }

  function _yallToken() internal view returns (IYALLToken) {
    return IYALLToken(yallRegistry.getYallTokenAddress());
  }

  function _yallTokenIERC20() internal view returns (IERC20) {
    return IERC20(yallRegistry.getYallTokenAddress());
  }

  function _yallDistributor() internal view returns (IYALLDistributor) {
    return IYALLDistributor(yallRegistry.getYallDistributorAddress());
  }

  function _yallVerification() internal view returns (IYALLVerification) {
    return IYALLVerification(yallRegistry.getYallVerificationAddress());
  }

  function _homeMediator() internal view returns (IStakingHomeMediator) {
    return IStakingHomeMediator(yallRegistry.getYallHomeMediatorAddress());
  }

  function _feeCollector() internal view returns (address) {
    return yallRegistry.getYallFeeCollectorAddress();
  }

  function _gsnFeeCollector() internal view returns (address) {
    return yallRegistry.getYallGsnFeeCollectorAddress();
  }

  function _yallDistributorAndFeeCollector() internal view returns (IYALLDistributor, address) {
    (address dist, address feeCollector) = yallRegistry.getYallDistributorAndFeeCollectorAddress();
    return (IYALLDistributor(dist), feeCollector);
  }

  function _yallTokenIERC20AndGsnFeeCollector() internal view returns (IERC20, address) {
    (address token, address feeCollector) = yallRegistry.getYallTokenAndGsnFeeCollectorAddress();
    return (IERC20(token), feeCollector);
  }
}
