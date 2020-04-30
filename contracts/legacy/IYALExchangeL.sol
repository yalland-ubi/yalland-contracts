/*
 * Copyright ©️ 2020 Galt•Project Society Construction and Terraforming Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka)
 *
 * Copyright ©️ 2020 Galt•Core Blockchain Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka) by
 * [Basic Agreement](ipfs/QmaCiXUmSrP16Gz8Jdzq6AJESY1EAANmmwha15uR3c1bsS)).
 */

pragma solidity ^0.5.13;


/**
 * @title YALLExchange contract
 * @author Galt Project
 * @notice Exchange YALL to another currency
 **/
interface IYALLExchangeL {
  function calculateMaxYalToSell(bytes32 _memberId) external view returns(uint256);
  function calculateMaxYalToSellByAddress(address _memberAddress) external view returns(uint256);
}
