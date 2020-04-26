/*
 * Copyright ©️ 2020 Galt•Project Society Construction and Terraforming Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka)
 *
 * Copyright ©️ 2020 Galt•Core Blockchain Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka) by
 * [Basic Agreement](ipfs/QmaCiXUmSrP16Gz8Jdzq6AJESY1EAANmmwha15uR3c1bsS)).
 */

pragma solidity ^0.5.13;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./YALLRegistry.sol";
import "../interfaces/IYALLDistributor.sol";
import "../interfaces/IYALLToken.sol";

/**
 * @title YALLRegistry contract
 * @author Galt Project
 * @notice Contract address and ACL registry
 **/
contract YALLRegistryHelpers {
  YALLRegistry public yallRegistry;

  function _yallTokenAddress() internal view returns (address) {
    return yallRegistry.getYallTokenAddress();
  }

  function _yallToken() internal view returns (IYALLToken) {
    return IYALLToken(yallRegistry.getYallTokenAddress());
  }

  function _yallTokenIERC20() internal view returns (IERC20) {
    return IERC20(yallRegistry.getYallTokenAddress());
  }

  function _yallDistributor() internal view returns (IYALLDistributor) {
    return IYALLDistributor(yallRegistry.getYallDistributorAddress());
  }
}
