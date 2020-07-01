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
  uint256 public constant MAX_VERIFIER_COUNT = 50;

  uint256 public verifierMinimalLockedStake;

  // MODIFIERS
  modifier verifierExists(address _rootAddress, address _verificationAddress) {
    requireVerificationAddressActive(_rootAddress, _verificationAddress);
    _;
  }

  modifier transactionExists(uint256 _transactionId) {
    require(transactions[_transactionId].destination != address(0), "YALLVerification: Only wallet allowed");
    _;
  }

  modifier hasEnoughLockedStake(address _rootKey) {
    uint256 currentLockedStake = _homeMediator().lockedBalanceOf(_rootKey);
    require(currentLockedStake >= verifierMinimalLockedStake, "YALLVerification: Not enough locked stake");
    _;
  }

  modifier confirmed(uint256 _transactionId, address _rootAddress) {
    require(confirmations[_transactionId][_rootAddress], "YALLVerification: Not confirmed by the msg.sender");
    _;
  }

  modifier notConfirmed(
    uint256 _transactionId,
    address _rootAddress,
    address _verificationAddress
  ) {
    require(!confirmations[_transactionId][_rootAddress], "YALLVerification: Is confirmed by the msg.sender");
    _;
  }

  modifier notExecuted(uint256 _transactionId) {
    require(!transactions[_transactionId].executed, "YALLVerification: Already executed");
    _;
  }

  modifier notNull(address _address) {
    require(_address != address(0), "YALLVerification: Can't send to 0x0 address");
    _;
  }

  modifier validRequirement(uint256 _verifierCount, uint256 _required) {
    require(
      _verifierCount <= MAX_VERIFIER_COUNT && _required <= _verifierCount && _required != 0 && _verifierCount != 0,
      "YALLVerification: Only wallet allowed"
    );
    _;
  }

  // INITIALIZER
  function initialize(address _yallRegistry) external initializer {
    yallRegistry = YALLRegistry(_yallRegistry);
  }

  // GOVERNANCE INTERFACE
  function setVerifierMinimalLockedStake(uint256 _verifierMinimalLockedStake) external onlyGovernance {
    verifierMinimalLockedStake = _verifierMinimalLockedStake;
  }

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

    if (required != newRequired) {
      emit ChangeRequired(newRequired);
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

  // VERIFIER INTERFACE
  function setVerifierAddresses(
    address _verificationAddress,
    address _payoutAddress,
    address _dataManagementAddress
  ) external {
    Verifier storage v = verifiers[msg.sender];

    require(v.createdAt > 0, "YALLVerification: Invalid verifier");

    v.verificationAddress = _verificationAddress;
    v.payoutAddress = _payoutAddress;
    v.dataManagementAddress = _dataManagementAddress;

    emit SetVerifierAddresses(msg.sender, _verificationAddress, _payoutAddress, _dataManagementAddress);
  }

  function submitTransaction(
    address _destination,
    uint256 _value,
    bytes memory _data,
    address _rootAddress
  ) public hasEnoughLockedStake(_rootAddress) returns (uint256 transactionId) {
    transactionId = _addTransaction(_destination, _value, _data);
    confirmTransaction(transactionId, _rootAddress);
  }

  function confirmTransaction(uint256 _transactionId, address _rootAddress)
    public
    hasEnoughLockedStake(_rootAddress)
    verifierExists(_rootAddress, msg.sender)
    transactionExists(_transactionId)
    notConfirmed(_transactionId, _rootAddress, msg.sender)
  {
    confirmations[_transactionId][_rootAddress] = true;
    emit Confirmation(_rootAddress, _transactionId);
    executeTransaction(_transactionId, _rootAddress);
  }

  function revokeConfirmation(uint256 _transactionId, address _rootAddress)
    public
    verifierExists(_rootAddress, msg.sender)
    confirmed(_transactionId, _rootAddress)
    notExecuted(_transactionId)
  {
    confirmations[_transactionId][_rootAddress] = false;
    emit Revocation(_rootAddress, _transactionId);
  }

  function executeTransaction(uint256 _transactionId, address _rootAddress)
    public
    verifierExists(_rootAddress, msg.sender)
    confirmed(_transactionId, _rootAddress)
    notExecuted(_transactionId)
  {
    if (isConfirmed(_transactionId)) {
      Transaction storage txn = transactions[_transactionId];
      txn.executed = true;
      if (_externalCall(txn.destination, txn.value, txn.data.length, txn.data)) emit Execution(_transactionId);
      else {
        emit ExecutionFailure(_transactionId);
        txn.executed = false;
      }
    }
  }

  // INTERNAL
  function _addTransaction(
    address _destination,
    uint256 _value,
    bytes memory _data
  ) internal notNull(_destination) returns (uint256 transactionId) {
    transactionId = transactionCount;
    transactions[transactionId] = Transaction({destination: _destination, value: _value, data: _data, executed: false});
    transactionCount += 1;
    emit Submission(transactionId);
  }

  // PRIVATE
  function _externalCall(
    address destination,
    uint256 value,
    uint256 dataLength,
    bytes memory data
  ) private returns (bool) {
    bool result;
    /* solhint-disable no-inline-assembly */
    assembly {
      let x := mload(0x40) // "Allocate" memory for output (0x40 is where "free memory" pointer is stored by convention)
      let d := add(data, 32) // First 32 bytes are the padded length of data, so exclude that
      result := call(
        sub(gas, 34710), // 34710 is the value that solidity is currently emitting
        // It includes callGas (700) + callVeryLow (3, to pay for SUB) + callValueTransferGas (9000) +
        // callNewAccountGas (25000, in case the destination address does not exist and needs creating)
        destination,
        value,
        d,
        dataLength, // Size of the input (in bytes) - this is what fixes the padding problem
        x,
        0 // Output is ignored, therefore the output size is zero
      )
    }
    return result;
  }

  // GETTERS
  /*
   * @dev In most cases YALLEmissionRewardPool and YALLCommissionRewardPool use the same general approach
   *      when deciding whether a member is eligible for a payout or not. If this approach can't be applied
   *      for a particular case, the decision should be made somewhere outside this contract.
   */
  function requireVerifierCanClaimRewardGeneralized(address _rootAddress, address _payoutAddress) external view {
    Verifier storage v = verifiers[_rootAddress];

    require(v.payoutAddress == _payoutAddress, "YALLVerification: Payout address mismatches");

    IYALLDistributor dist = _yallDistributor();

    _requireCanClaimReward(
      v.active,
      dist.getCurrentPeriodId(),
      dist.getCurrentPeriodBeginsAt(),
      v.createdAt,
      v.lastEnabledAt,
      v.lastDisabledAt
    );
  }

  function requireVerificationAddressActive(address _rootAddress, address _verificationAddress) public view {
    require(
      isVerificationAddressActive(_rootAddress, _verificationAddress) == true,
      "YALLVerification: Invalid address pair for verification"
    );
  }

  function requirePayoutAddressActive(address _rootAddress, address _payoutAddress) public view {
    require(
      isPayoutAddressActive(_rootAddress, _payoutAddress) == true,
      "YALLVerification: Invalid address pair for payout"
    );
  }

  function requireDataManagementAddressActive(address _rootAddress, address _dataManagementAddress) public view {
    require(
      isDataManagementAddressActive(_rootAddress, _dataManagementAddress) == true,
      "YALLVerification: Invalid address pair for dataManagement"
    );
  }

  function isVerificationAddressActive(address _rootAddress, address _verificationAddress) public view returns (bool) {
    Verifier storage v = verifiers[_rootAddress];
    return v.active == true && v.verificationAddress == _verificationAddress;
  }

  function isPayoutAddressActive(address _rootAddress, address _payoutAddress) public view returns (bool) {
    Verifier storage v = verifiers[_rootAddress];
    return v.active == true && v.payoutAddress == _payoutAddress;
  }

  function isDataManagementAddressActive(address _rootAddress, address _dataManagementAddress)
    public
    view
    returns (bool)
  {
    Verifier storage v = verifiers[_rootAddress];
    return v.active == true && v.dataManagementAddress == _dataManagementAddress;
  }

  function getActiveVerifiers() public view returns (address[] memory) {
    return _activeAddressesCache.enumerate();
  }

  function getActiveVerifierCount() public view returns (uint256) {
    return _activeAddressesCache.length();
  }

  function isConfirmed(uint256 _transactionId) public view returns (bool) {
    uint256 count = 0;
    address[] memory verifiers = getActiveVerifiers();
    uint256 len = verifiers.length;

    for (uint256 i = 0; i < len; i++) {
      if (confirmations[_transactionId][verifiers[i]]) count += 1;
      if (count == required) return true;
    }

    return false;
  }

  function getConfirmationCount(uint256 transactionId) public view returns (uint256 count) {
    address[] memory verifiers = getActiveVerifiers();
    uint256 len = verifiers.length;

    for (uint256 i = 0; i < len; i++) {
      if (confirmations[transactionId][verifiers[i]]) {
        count += 1;
      }
    }
  }

  function getTransactionCount(bool pending, bool executed) public view returns (uint256 count) {
    for (uint256 i = 0; i < transactionCount; i++) {
      if ((pending && !transactions[i].executed) || (executed && transactions[i].executed)) {
        count += 1;
      }
    }
  }

  function getConfirmations(uint256 transactionId) public view returns (address[] memory _confirmations) {
    address[] memory verifiers = getActiveVerifiers();
    uint256 len = verifiers.length;

    address[] memory confirmationsTemp = new address[](len);
    uint256 count = 0;
    uint256 i;
    for (i = 0; i < verifiers.length; i++)
      if (confirmations[transactionId][verifiers[i]]) {
        confirmationsTemp[count] = verifiers[i];
        count += 1;
      }
    _confirmations = new address[](count);
    for (i = 0; i < count; i++) _confirmations[i] = confirmationsTemp[i];
  }

  function getTransactionIds(
    uint256 from,
    uint256 to,
    bool pending,
    bool executed
  ) public view returns (uint256[] memory _transactionIds) {
    uint256[] memory transactionIdsTemp = new uint256[](transactionCount);
    uint256 count = 0;
    uint256 i;
    for (i = 0; i < transactionCount; i++)
      if ((pending && !transactions[i].executed) || (executed && transactions[i].executed)) {
        transactionIdsTemp[count] = i;
        count += 1;
      }
    _transactionIds = new uint256[](to - from);
    for (i = from; i < to; i++) _transactionIds[i - from] = transactionIdsTemp[i];
  }
}
