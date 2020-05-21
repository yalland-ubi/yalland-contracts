/*
 * Copyright ©️ 2020 Galt•Project Society Construction and Terraforming Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka)
 *
 * Copyright ©️ 2020 Galt•Core Blockchain Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka) by
 * [Basic Agreement](ipfs/QmaCiXUmSrP16Gz8Jdzq6AJESY1EAANmmwha15uR3c1bsS)).
 */

pragma solidity ^0.5.13;


interface IYALLExchange {
  enum OrderStatus {
    NULL,
    OPEN,
    CLOSED,
    CANCELLED,
    VOIDED
  }

  // CONSTANTS
  // solhint-disable-next-line func-name-mixedcase
  function RATE_DIVIDER() external pure returns (uint256);

  // PUBLIC VARIABLES
  function defaultExchangeRate() external returns (uint256);
  function defaultMemberPeriodLimit() external returns (uint256);
  function totalPeriodLimit() external returns (uint256);
  function gsnFee() external returns (uint256);
  function totalExchangedYall() external returns (uint256);
  function yallExchangedByPeriod(uint256 _periodId) external returns (uint256);

  // PUBLIC MAPPINGS
  function members(bytes32 _memberId)
    external
    view
    returns(
      uint256 customExchangeRate,
      uint256 customPeriodLimit,
      uint256 totalExchanged,
      uint256 totalVoided
    );

  function orders(uint256 _orderId)
    external
    view
    returns (
      OrderStatus status,
      bytes32 memberId,
      uint256 yallAmount,
      uint256 buyAmount,
      uint256 createdAt,
      uint256 createdAtPeriod,
      string memory paymentDetails
    );

  // EXTERNAL MANAGER INTERFACE
  function setDefaultExchangeRate(uint256 _defaultExchangeRate) external;
  function setCustomExchangeRate(bytes32 _memberId, uint256 _customExchangeRate) external;
  function setTotalPeriodLimit(uint256 _totalPeriodLimit) external;
  function setDefaultMemberPeriodLimit(uint256 _defaultMemberPeriodLimit) external;
  function setCustomPeriodLimit(bytes32 _memberId, uint256 _customPeriodLimit) external;

  // FEE MANAGER INTERFACE
  function setGsnFee(uint256 _gsnFee) external;

  // OPERATOR INTERFACE
  function closeOrder(uint256 _orderId, string calldata _paymentDetails) external;
  function cancelOrder(uint256 _orderId, string calldata _cancelReason) external;

  // SUPER OPERATOR INTERFACE
  function voidOrder(uint256 _orderId) external;

  // MEMBER INTERFACE
  function createOrder(uint256 _yallAmount) external;

  // GETTERS
  function calculateBuyAmount(bytes32 _memberId, uint256 _yallAmount) external view returns(uint256);
  function calculateMemberExchangeRate(bytes32 _memberId) external view returns(uint256);
  function calculateMaxYallToSell(bytes32 _memberId) external view returns(uint256);
  function calculateMaxYallToSellByAddress(address _memberAddress) external view returns(uint256);
  function checkExchangeFitsLimit1(bytes32 _memberId, uint256 _yallAmount) external view returns (bool);
  function checkExchangeFitsLimit2(bytes32 _memberId, uint256 _yallAmount, uint256 _periodId) external view returns (bool);
  function checkExchangeFitsLimit3(uint256 _yallAmount, uint256 _periodId) external view returns (bool);
  function getCustomExchangeRate(bytes32 _memberId) external view returns (uint256);
  function getCustomPeriodLimit(bytes32 _memberId) external view returns (uint256);
  function getMemberYallExchangedInCurrentPeriod(bytes32 _memberId) external view returns (uint256);
  function getMemberYallExchangedByPeriod(bytes32 _memberId, uint256 _periodId) external view returns (uint256);
}
