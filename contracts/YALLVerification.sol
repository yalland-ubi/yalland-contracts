/*
 * Copyright ©️ 2020 Galt•Project Society Construction and Terraforming Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka)
 *
 * Copyright ©️ 2020 Galt•Core Blockchain Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka) by
 * [Basic Agreement](ipfs/QmaCiXUmSrP16Gz8Jdzq6AJESY1EAANmmwha15uR3c1bsS)).
 */

pragma solidity ^0.5.13;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
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
contract YALLVerification is
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

  function initialize(
    address _yallRegistry
  )
    external
    initializer
  {
    yallRegistry = YALLRegistry(_yallRegistry);
  }

  function addVerifiers(address[] calldata _verifierAddresses) external {
    uint256 len = _verifierAddresses.length;

    require(len > 0, "YALLVerification: Missing input verifiers");

    for (uint256 i = 0; i < len; i++) {
      _addVerifier(_verifierAddresses[i]);
    }

    _incrementActiveVerifierCount(len);
  }

  function _addVerifier(address _verifierAddress) internal {
    Verifier storage v = verifiers[_verifierAddress];

    v.addr = _verifierAddress;
    v.active = true;
    v.createdAt = now;

    activeAddressesCache.add(_verifierAddress);

//    emit AddMember(_verifierId, _verifierAddress);
  }

  function _incrementActiveVerifierCount(uint256 _n) internal {
    uint256 newActiveVerifierCount = activeVerifierCount.add(_n);
    activeVerifierCount = newActiveVerifierCount;

//    emit ActiveMemberCountChanged(newActiveVerifierCount);
  }
}
