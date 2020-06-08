/*
 * Copyright ©️ 2020 Galt•Project Society Construction and Terraforming Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka)
 *
 * Copyright ©️ 2020 Galt•Core Blockchain Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka) by
 * [Basic Agreement](ipfs/QmaCiXUmSrP16Gz8Jdzq6AJESY1EAANmmwha15uR3c1bsS)).
 */

pragma solidity ^0.5.17;

import "./registry/YALLRegistryHelpers.sol";
import "./YALLVerificationCore.sol";
import "./traits/YALLRewardClaimer.sol";

/**
 * @title YALLVerification contract
 * @author Galt Project
 * @notice Verification interface for verifiers
 **/
contract YALLVerification is YALLVerificationCore, YALLRewardClaimer {
  function initialize(address _yallRegistry) external initializer {
    yallRegistry = YALLRegistry(_yallRegistry);
  }

  // GOVERNANCE INTERFACE
  function setVerifiers(address[] calldata _newVerifierAddresses, uint256 newRequired) external onlyGovernance {
    uint256 newLength = _newVerifierAddresses.length;

    require(newLength > 0, "YALLVerification: Missing input verifiers");
    require(newRequired > 0, "YALLVerification: newRequired should be greater than 0");
    require(newLength >= newRequired, "YALLVerification: Requires verifiers.length >= newRequired");

    address[] memory existingVerifiers = getActiveVerifiers();
    uint256 existingLength = existingVerifiers.length;

    // Disable of required
    for (uint256 i = 0; i < existingLength; i++) {
      _disableIfRequired(existingVerifiers[i], _newVerifierAddresses);
    }

    // Add or enable
    for (uint256 i = 0; i < newLength; i++) {
      _addOrEnable(_newVerifierAddresses[i], existingVerifiers);
    }

    required = newRequired;
  }

  function _disableIfRequired(address _existingVerifier, address[] memory _newVerifierAddresses) internal {
    uint256 newLength = _newVerifierAddresses.length;

    for (uint256 i = 0; i < newLength; i++) {
      if (_newVerifierAddresses[i] == _existingVerifier) {
        return;
      }
    }

    Verifier storage v = verifiers[_existingVerifier];
    require(v.active == true, "YALLVerification: One of the verifiers is inactive");

    v.active = false;
    v.lastDisabledAt = now;

    _activeAddressesCache.remove(_existingVerifier);

    emit DisableVerifier(_existingVerifier);
  }

  function _addOrEnable(address _newVerifier, address[] memory _existingVerifierAddresses) internal {
    uint256 existingLength = _existingVerifierAddresses.length;

    for (uint256 i = 0; i < existingLength; i++) {
      if (_existingVerifierAddresses[i] == _newVerifier) {
        return;
      }
    }

    Verifier storage v = verifiers[_newVerifier];

    if (v.createdAt == 0) {
      // add
      v.active = true;
      v.createdAt = now;

      emit AddVerifier(_newVerifier);
    } else {
      // enable
      require(v.active == false, "YALLVerification: Verifier is already enabled");
      v.active = true;
      v.lastEnabledAt = now;

      emit EnableVerifier(_newVerifier);
    }

    _activeAddressesCache.add(_newVerifier);
  }

  // GETTERS
  function getActiveVerifiers() public view returns (address[] memory) {
    return _activeAddressesCache.enumerate();
  }

  function getActiveVerifierCount() public view returns (uint256) {
    return _activeAddressesCache.length();
  }
}
