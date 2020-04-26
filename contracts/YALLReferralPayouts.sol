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
import "@galtproject/libs/contracts/traits/OwnableAndInitializable.sol";
import "./traits/OwnedAccessControl.sol";


/**
 * @title YALLReferralPayouts contract
 * @author Galt Project
 **/
contract YALLReferralPayouts is OwnableAndInitializable, OwnedAccessControl {
  string public constant OPERATOR_ROLE = "operator";

  IERC20 public yallToken;

  mapping(uint256 => bool) public payouts;

  modifier onlyOperator() {
    require(hasRole(msg.sender, OPERATOR_ROLE), "YALLReferralPayouts: Only operator role allowed");

    _;
  }

  function initialize(
    address _initialOwner,
    address _yallToken
  )
    external
    initializeWithOwner(_initialOwner)
  {
    require(_yallToken != address(0), "YALLReferralPayouts: YALLToken address can't be 0");

    yallToken = IERC20(_yallToken);
  }

  // OPERATOR INTERFACE

  event Payout(address indexed operator, address indexed _to, uint256 _id, uint256 _amount);

  function payout(uint256 _id, address _to, uint256 _amount) external onlyOperator {
    require(payouts[_id] == false, "YALLReferralPayouts: Payout already registered");

    payouts[_id] = true;

    emit Payout(msg.sender, _to, _id, _amount);

    yallToken.transfer(_to, _amount);
  }
}
