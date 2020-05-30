/*
 * Copyright ©️ 2020 Galt•Project Society Construction and Terraforming Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka)
 *
 * Copyright ©️ 2020 Galt•Core Blockchain Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka) by
 * [Basic Agreement](ipfs/QmaCiXUmSrP16Gz8Jdzq6AJESY1EAANmmwha15uR3c1bsS)).
 */

pragma solidity ^0.5.17;

import "@openzeppelin/contracts/access/Roles.sol";
import "@openzeppelin/contracts/ownership/Ownable.sol";


contract OwnedAccessControl is Ownable {
  using Roles for Roles.Role;

  event AddRole(address indexed account, string role);
  event RemoveRole(address indexed account, string role);

  mapping (string => Roles.Role) private roles;

  constructor() public {
  }

  modifier onlyRole(string memory _role) {
    require(roles[_role].has(msg.sender), "Invalid role");

    _;
  }

  function hasRole(address _account, string memory _role) public view returns (bool) {
    return roles[_role].has(_account);
  }

  function requireHasRole(address _account, string memory _role) public view {
    require(roles[_role].has(_account), "Invalid role");
  }

  function addRoleTo(address _account, string memory _role) public onlyOwner {
    _addRoleTo(_account, _role);
  }

  function removeRoleFrom(address _account, string memory _role) public onlyOwner {
    _removeRoleFrom(_account, _role);
  }

  function _addRoleTo(address _account, string memory _role) internal {
    roles[_role].add(_account);
    emit AddRole(_account, _role);
  }

  function _removeRoleFrom(address _account, string memory _role) internal {
    roles[_role].remove(_account);
    emit RemoveRole(_account, _role);
  }
}
