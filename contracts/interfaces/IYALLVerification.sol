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
      address verificationAddress,
      address payoutAddress,
      address dataManagementAddress,
      uint256 createdAt,
      uint256 lastEnabledAt,
      uint256 lastDisabledAt
    );

  // VERIFIER INTERFACE
  function setVerifierAddresses(
    address _verificationAddress,
    address _payoutAddress,
    address _dataManagementAddress
  ) external;

  function submitTransaction(
    address _destination,
    uint256 _value,
    bytes calldata _data,
    address _rootAddress
  ) external returns (uint256 transactionId);

  function confirmTransaction(uint256 _transactionId, address _rootAddress) external;

  function revokeConfirmation(uint256 _transactionId, address _rootAddress) external;

  // GETTERS
  function requireVerifierCanClaimRewardGeneralized(address _rootAddress, address _payoutAddress) external view;

  function requireVerificationAddressActive(address _rootAddress, address _verificationAddress) external view;

  function requirePayoutAddressActive(address _rootAddress, address _payoutAddress) external view;

  function requireDataManagementAddressActive(address _rootAddress, address _dataManagementAddress) external view;

  function isVerificationAddressActive(address _rootAddress, address _verificationAddress) external view returns (bool);

  function isPayoutAddressActive(address _rootAddress, address _payoutAddress) external view returns (bool);

  function isDataManagementAddressActive(address _rootAddress, address _dataManagementAddress)
    external
    view
    returns (bool);

  function getActiveVerifiers() external view returns (address[] memory);

  function getActiveVerifierCount() external view returns (uint256);

  function isConfirmed(uint256 _transactionId) external view returns (bool);

  function getConfirmationCount(uint256 transactionId) external view returns (uint256 count);

  function getTransactionCount(bool pending, bool executed) external view returns (uint256 count);

  function getConfirmations(uint256 transactionId) external view returns (address[] memory _confirmations);

  function getTransactionIds(
    uint256 from,
    uint256 to,
    bool pending,
    bool executed
  ) external view returns (uint256[] memory _transactionIds);
}
