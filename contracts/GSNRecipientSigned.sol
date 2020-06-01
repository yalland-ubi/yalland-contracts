pragma solidity ^0.5.17;

import "@openzeppelin/contracts/GSN/GSNRecipient.sol";
import "@openzeppelin/contracts/cryptography/ECDSA.sol";

contract GSNRecipientSigned is GSNRecipient {
  using ECDSA for bytes32;

  // solhint-disable-next-line private-vars-leading-underscore
  address internal constant DEFAULT_RELAY_HUB = 0xD216153c06E857cD7f72665E0aF1d7D82172F494;

  enum GSNRecipientSignatureErrorCodes {
    METHOD_NOT_SUPPORTED,
    OK,
    DENIED,
    INSUFFICIENT_BALANCE,
    SIGNER_DOESNT_MATCH_FROM
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
  ) external view returns (uint256, bytes memory) {
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
    address signer = keccak256(blob).toEthSignedMessageHash().recover(approvalData);

    if (signer != from) {
      return _rejectRelayedCall(uint256(GSNRecipientSignatureErrorCodes.SIGNER_DOESNT_MATCH_FROM));
    }

    (GSNRecipientSignatureErrorCodes code, bytes memory context) = _handleRelayedCall(encodedFunction, signer);

    if (code == GSNRecipientSignatureErrorCodes.OK) {
      return _approveRelayedCall(context);
    } else {
      return _rejectRelayedCall(uint256(code));
    }
  }

  function _handleRelayedCall(bytes memory _encodedFunction, address _caller)
    internal
    view
    returns (GSNRecipientSignatureErrorCodes, bytes memory);

  function getDataSignature(bytes memory _encodedFunction) public pure returns (bytes4 signature) {
    assembly {
      // solhint-disable-previous-line no-inline-assembly
      signature := mload(add(_encodedFunction, 0x20))
    }
  }

  function _preRelayedCall(bytes memory) internal returns (bytes32) {}

  function _postRelayedCall(
    bytes memory,
    bool,
    uint256,
    bytes32
  ) internal {}
}
