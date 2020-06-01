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
  function activeVerifierCount() external returns (uint256);

  function addVerifiers(address[] calldata _verifierAddresses) external;

  function verifiers(address _verifier)
    external
    view
    returns (
      bool active,
      address addr,
      uint256 createdAt,
      uint256 lastEnabledAt,
      uint256 lastDisabledAt
    );
}
