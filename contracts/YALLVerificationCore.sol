/*
 * Copyright ©️ 2020 Galt•Project Society Construction and Terraforming Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka)
 *
 * Copyright ©️ 2020 Galt•Core Blockchain Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka) by
 * [Basic Agreement](ipfs/QmaCiXUmSrP16Gz8Jdzq6AJESY1EAANmmwha15uR3c1bsS)).
 */

pragma solidity ^0.5.13;

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
contract YALLVerificationCore is
  IYALLVerification,
  Initializable,
  YALLRegistryHelpers,
  ACLPausable
{
  using SafeMath for uint256;
  using EnumerableSet for EnumerableSet.AddressSet;

  struct Verifier {
    bool active;
    address addr;
    uint256 createdAt;
    uint256 lastEnabledAt;
    uint256 lastDisabledAt;
  }

  uint256 public activeVerifierCount;
  mapping(address => Verifier) public verifiers;
  EnumerableSet.AddressSet internal activeAddressesCache;
}
