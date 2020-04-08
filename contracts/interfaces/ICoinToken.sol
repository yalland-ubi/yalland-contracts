/*
 * Copyright ©️ 2018 Galt•Project Society Construction and Terraforming Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka)
 *
 * Copyright ©️ 2018 Galt•Core Blockchain Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka) by
 * [Basic Agreement](ipfs/QmaCiXUmSrP16Gz8Jdzq6AJESY1EAANmmwha15uR3c1bsS)).
 */

pragma solidity ^0.5.13;


interface ICoinToken {
  function mint(address to, uint256 amount) external returns (bool);
  function burn(address account, uint256 amount) external;
  function gsnFee() external view returns(uint256);
  function transferFee() external view returns(uint256);
  function getTransferFee(uint256 amount) external view returns(uint256);
}