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

/**
 * @title YALLVerification contract
 * @author Galt Project
 * @notice Verification interface for verifiers
 **/
contract YALLVerification is YALLVerificationCore {
  function initialize(address _yallRegistry) external initializer {
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

  function disableVerifiers(address[] calldata _verifierAddresses) external {
    uint256 len = _verifierAddresses.length;

    require(len > 0, "YALLDistributor: Missing input verifiers");

    for (uint256 i = 0; i < len; i++) {
      Verifier storage v = verifiers[_verifierAddresses[i]];
      require(v.active == true, "YALLDistributor: One of the verifiers is inactive");

      v.active = false;
      v.lastDisabledAt = now;

      //      emit DisableMember(memberId, addr);
    }

    _decrementActiveVerifierCount(len);
  }

  function _addVerifier(address _verifierAddress) internal {
    Verifier storage v = verifiers[_verifierAddress];

    v.addr = _verifierAddress;
    v.active = true;
    v.createdAt = now;

    _activeAddressesCache.add(_verifierAddress);

    //    emit AddMember(_verifierId, _verifierAddress);
  }

  function _incrementActiveVerifierCount(uint256 _n) internal {
    uint256 newActiveVerifierCount = activeVerifierCount.add(_n);
    activeVerifierCount = newActiveVerifierCount;

    //    emit ActiveMemberCountChanged(newActiveVerifierCount);
  }

  function _decrementActiveVerifierCount(uint256 _n) internal {
    uint256 newActiveVerifierCount = activeVerifierCount.sub(_n);
    activeVerifierCount = newActiveVerifierCount;

    //    emit ActiveMemberCountChanged(newActiveVerifierCount);
  }
}
