/*
 * Copyright ©️ 2020 Galt•Project Society Construction and Terraforming Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka)
 *
 * Copyright ©️ 2020 Galt•Core Blockchain Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka) by
 * [Basic Agreement](ipfs/QmaCiXUmSrP16Gz8Jdzq6AJESY1EAANmmwha15uR3c1bsS)).
 */

pragma solidity ^0.5.17;

interface IYALLVerification {
  // OWNER INTERFACE
  function setVerifiers(address[] calldata _newVerifierAddresses, uint256 _newM) external;

  // PUBLIC MAPPINGS
  function verifiers(address _verifier)
    external
    view
    returns (
      bool active,
      uint256 createdAt,
      uint256 lastEnabledAt,
      uint256 lastDisabledAt
    );

  // GETTERS
  function getActiveVerifierCount() external view returns (uint256);
}
