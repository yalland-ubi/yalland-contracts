/*
 * Copyright ©️ 2020 Galt•Project Society Construction and Terraforming Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka)
 *
 * Copyright ©️ 2020 Galt•Core Blockchain Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka) by
 * [Basic Agreement](ipfs/QmaCiXUmSrP16Gz8Jdzq6AJESY1EAANmmwha15uR3c1bsS)).
 */

pragma solidity ^0.5.17;

import "@openzeppelin/upgrades/contracts/Initializable.sol";
import "@openzeppelin/contracts/ownership/Ownable.sol";

/**
 * @title YALLRegistry contract
 * @author Galt Project
 * @notice Contract address and ACL registry
 **/
contract YALLRegistryCore is Initializable, Ownable {
  // solhint-disable-next-line private-vars-leading-underscore
  address internal constant ZERO_ADDRESS = address(0);

  event SetContract(bytes32 indexed key, address addr);
  event SetRole(bytes32 indexed role, address indexed candidate, bool allowed);

  // Mapping (contractKey => currentAddress)
  mapping(bytes32 => address) internal _contracts;
  // Mapping (roleName => (address => isAllowed))
  mapping(bytes32 => mapping(address => bool)) internal _roles;

  // @dev owner is set to tx.origin
  function initialize() public initializer {
    // solhint-disable-next-line avoid-tx-origin
    _transferOwnership(tx.origin);
  }

  /**
   * @notice Set a contract address.
   *
   * @param _key bytes32 encoded contract key
   * @param _value contract address
   */
  function setContract(bytes32 _key, address _value) external onlyOwner {
    _contracts[_key] = _value;
    emit SetContract(_key, _value);
  }

  /**
   * @notice Sets role permissions.
   *
   * @param _candidate address
   * @param _role bytes32 encoded role name
   * @param _allow true to enable, false to disable
   */
  function setRole(
    address _candidate,
    bytes32 _role,
    bool _allow
  ) external onlyOwner {
    _roles[_role][_candidate] = _allow;
    emit SetRole(_role, _candidate, _allow);
  }

  // GETTERS
  function getContract(bytes32 _key) external view returns (address) {
    return _contracts[_key];
  }

  function hasRole(address _candidate, bytes32 _role) external view returns (bool) {
    return _roles[_role][_candidate];
  }
}
