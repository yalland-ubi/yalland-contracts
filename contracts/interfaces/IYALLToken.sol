/*
 * Copyright ©️ 2018 Galt•Project Society Construction and Terraforming Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka)
 *
 * Copyright ©️ 2018 Galt•Core Blockchain Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka) by
 * [Basic Agreement](ipfs/QmaCiXUmSrP16Gz8Jdzq6AJESY1EAANmmwha15uR3c1bsS)).
 */

pragma solidity ^0.5.13;


interface IYALLToken {
  // CONSTANTS
  function HUNDRED_PCT() external pure returns (uint256);

  // PUBLIC VARIABLES
  function transferFee() external view returns(uint256);
  function gsnFee() external view returns(uint256);

  // PUBLIC MAPPINGS
  function opsWhitelist(address _addr) external view returns(bool);

  // MINTER INTERFACE
  function mint(address to, uint256 amount) external returns (bool);

  // BURNER INTERFACE
  function burn(address account, uint256 amount) external;

  // WHITELIST MANAGER INTERFACE
  function setWhitelistAddress(address _addr, bool _isActive) external;

  // FEE MANAGER INTERFACE
  function setTransferFee(uint256 _transferFee) external;
  function setGsnFee(uint256 _gsnFee) external;

  // FEE CLAIMER INTERFACE
  function withdrawFee() external;

  // GETTERS
  function getTransferFee(uint256 amount) external view returns(uint256);
  function isMemberValid(address _member) external view returns(bool);
  function canPayForGsnCall(address _addr) external view returns (bool);
}
