pragma solidity ^0.5.0;

import "@openzeppelin/contracts/GSN/GSNRecipient.sol";
import "@openzeppelin/contracts/cryptography/ECDSA.sol";


contract GSNRecipientSigned is GSNRecipient {
  using ECDSA for bytes32;

  enum GSNRecipientSignatureErrorCodes {
    INVALID_SIGNER
  }

  constructor() public {}

  /**
   * @dev Ensures that only transactions with a trusted signature can be relayed through the GSN.
   */
  function acceptRelayedCall(
    address relay,
    address from,
    bytes calldata encodedFunction,
    uint256 transactionFee,
    uint256 gasPrice,
    uint256 gasLimit,
    uint256 nonce,
    bytes calldata approvalData,
    uint256
  )
    external
    view
    returns (uint256, bytes memory)
  {
    bytes memory blob = abi.encodePacked(
      relay,
      from,
      encodedFunction,
      transactionFee,
      gasPrice,
      gasLimit,
      nonce, // Prevents replays on RelayHub
      getHubAddr(), // Prevents replays in multiple RelayHubs
      address(this) // Prevents replays in multiple recipients
    );
    if (_canExecuteRelayedCall(keccak256(blob).toEthSignedMessageHash().recover(approvalData)) == true) {
      return _approveRelayedCall();
    } else {
      return _rejectRelayedCall(uint256(GSNRecipientSignatureErrorCodes.INVALID_SIGNER));
    }
  }

  function _canExecuteRelayedCall(address _caller) internal view returns (bool);

  function _preRelayedCall(bytes memory) internal returns (bytes32) {
    // solhint-disable-previous-line no-empty-blocks
  }

  function _postRelayedCall(bytes memory, bool, uint256, bytes32) internal {
    // solhint-disable-previous-line no-empty-blocks
  }
}