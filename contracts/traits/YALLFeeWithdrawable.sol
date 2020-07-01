/*
 * Copyright ©️ 2020 Galt•Project Society Construction and Terraforming Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka)
 *
 * Copyright ©️ 2020 Galt•Core Blockchain Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka) by
 * [Basic Agreement](ipfs/QmaCiXUmSrP16Gz8Jdzq6AJESY1EAANmmwha15uR3c1bsS)).
 */
pragma solidity ^0.5.17;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../interfaces/IYALLFeeWithdrawable.sol";
import "../registry/YALLRegistryHelpers.sol";

contract YALLFeeWithdrawable is IYALLFeeWithdrawable, YALLRegistryHelpers {
  uint256 public constant HUNDRED_PCT = 100 ether;

  event WithdrawFee(address indexed feeClaimer, bool indexed success, uint256 amount);

  // FEE CLAIMER INTERFACE
  function withdrawFee() external onlyFeeClaimer {
    address tokenAddress = _yallTokenAddress();
    uint256 balance = IERC20(tokenAddress).balanceOf(address(this));
    uint256 payout;

    // Always keep some amount (1 YALL <= amount <= 2 YALL) on contract to minimize gas charges for GSN _preRelayHook,
    // which has limit of 100K gas.
    // This prevents nullifying this contract balance storage slot,
    // so it won't charge 25K when storing a new balance value again.
    // Assumes that tx commission is < 1 ether
    if (balance <= 2 ether) {
      emit WithdrawFee(msg.sender, false, 0);
      return;
    } else {
      payout = balance - 1 ether;
    }

    emit WithdrawFee(msg.sender, true, payout);

    // the contract should be in noTransferFee whitelist
    IERC20(tokenAddress).transfer(msg.sender, payout);
  }
}
