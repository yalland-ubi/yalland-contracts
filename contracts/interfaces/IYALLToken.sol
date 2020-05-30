/*
 * Copyright ©️ 2018 Galt•Project Society Construction and Terraforming Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka)
 *
 * Copyright ©️ 2018 Galt•Core Blockchain Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka) by
 * [Basic Agreement](ipfs/QmaCiXUmSrP16Gz8Jdzq6AJESY1EAANmmwha15uR3c1bsS)).
 */

pragma solidity ^0.5.17;


interface IYALLToken {
  enum TransferRestrictionsMode {
    OFF,
    ONLY_MEMBERS,
    ONLY_WHITELIST,
    ONLY_MEMBERS_OR_WHITELIST
  }

  // CONSTANTS
  // solhint-disable-next-line func-name-mixedcase
  function HUNDRED_PCT() external pure returns (uint256);

  // PUBLIC VARIABLES
  function transferFee() external view returns(uint256);
  function gsnFee() external view returns(uint256);
  function transferRestrictions() external view returns(TransferRestrictionsMode);

  // PUBLIC MAPPINGS
  function canTransferWhitelist(address _addr) external view returns(bool);
  function noTransferFeeWhitelist(address _addr) external view returns(bool);

  // MINTER INTERFACE
  function mint(address to, uint256 amount) external returns (bool);

  // BURNER INTERFACE
  function burn(address account, uint256 amount) external;

  // YALL TOKEN MANAGER INTERFACE
  function setCanTransferWhitelistAddress(address _addr, bool _isActive) external;
  function setNoTransferFeeWhitelistAddress(address _addr, bool _isActive) external;
  function setTransferRestrictionMode(TransferRestrictionsMode _transferRestrictions) external;

  // FEE MANAGER INTERFACE
  function setTransferFee(uint256 _transferFee) external;
  function setGsnFee(uint256 _gsnFee) external;

  // GETTERS
  function getTransferFee(uint256 amount) external view returns(uint256);
  function deductTransferFee(uint256 amount) external view returns(uint256);
  function isMemberValid(address _member) external view returns(bool);
  function canPayForGsnCall(address _addr) external view returns (bool);
}
