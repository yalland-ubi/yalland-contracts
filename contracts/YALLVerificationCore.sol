/*
 * Copyright ©️ 2020 Galt•Project Society Construction and Terraforming Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka)
 *
 * Copyright ©️ 2020 Galt•Core Blockchain Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka) by
 * [Basic Agreement](ipfs/QmaCiXUmSrP16Gz8Jdzq6AJESY1EAANmmwha15uR3c1bsS)).
 */

pragma solidity ^0.5.17;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/utils/EnumerableSet.sol";
import "@openzeppelin/upgrades/contracts/Initializable.sol";
import "./registry/YALLRegistryHelpers.sol";
import "./traits/ACLPausable.sol";

/**
 * @title YALLVerification contract
 * @author Galt Project
 * @notice Verification interface for verifiers
 **/
contract YALLVerificationCore is IYALLVerification, Initializable, YALLRegistryHelpers, ACLPausable {
  using SafeMath for uint256;
  using EnumerableSet for EnumerableSet.AddressSet;

  event AddVerifier(address indexed verifier);
  event DisableVerifier(address indexed verifier);
  event EnableVerifier(address indexed verifier);

  struct Verifier {
    bool active;
    uint256 createdAt;
    uint256 lastEnabledAt;
    uint256 lastDisabledAt;
  }

  struct Transaction {
    address destination;
    uint256 value;
    bytes data;
    bool executed;
  }

  uint256 public required;
  uint256 public transactionCount;

  mapping(address => Verifier) public verifiers;
  EnumerableSet.AddressSet internal _activeAddressesCache;

  mapping(uint256 => Transaction) public transactions;
  mapping(uint256 => mapping(address => bool)) public confirmations;
}
