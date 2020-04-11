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
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@galtproject/libs/contracts/traits/OwnableAndInitializable.sol";
import "./interfaces/IYALDistributor.sol";
import "./interfaces/ICoinToken.sol";
import "./GSNRecipientSigned.sol";
import "./OwnedAccessControl.sol";


/**
 * @title YALExchange contract
 * @author Galt Project
 * @notice Exchange YAL to another currency
 **/
contract YALExchange is OwnableAndInitializable, OwnedAccessControl, GSNRecipientSigned {
  using SafeMath for uint256;

  event CloseOrder(uint256 indexed orderId, address operator);
  event CancelOrder(uint256 indexed orderId, address operator, string reason);
  event CreateOrder(uint256 indexed orderId, bytes32 indexed memberId, uint256 yalAmount, uint256 buyAmount);
  event SetDefaultExchangeRate(address indexed fundManager, uint256 defaultExchangeRate);
  event SetCustomExchangeRate(address indexed fundManager, bytes32 indexed memberId, uint256 memberExchangeRate);
  event SetTotalPeriodLimit(address indexed fundManager, uint256 defaultPeriodLimit);
  event SetDefaultMemberPeriodLimit(address indexed fundManager, uint256 memberPeriodLimit);
  event SetCustomPeriodLimit(address indexed fundManager, bytes32 indexed memberId, uint256 memberPeriodLimit);
  event VoidOrder(uint256 indexed orderId, address operator);

  enum OrderStatus {
    NULL,
    OPEN,
    CLOSED,
    CANCELLED,
    VOIDED
  }

  struct Order {
    OrderStatus status;
    bytes32 memberId;
    uint256 yalAmount;
    uint256 buyAmount;
    uint256 createdAt;
    string paymentDetails;
  }

  struct Member {
    uint256 customExchangeRate;
    uint256 customPeriodLimit;

    uint256 totalExchanged;
    uint256 totalVoided;
    uint256 totalOpen;

    // periodId => yal exchanged
    mapping(uint256 => uint256) yalExchangedByPeriod;
  }

  string public constant FUND_MANAGER_ROLE = "fund_manager";
  string public constant OPERATOR_ROLE = "operator";
  string public constant SUPER_OPERATOR_ROLE = "super_operator";

  uint256 public constant RATE_DIVIDER = 100 ether;

  uint256 internal idCounter;
  IERC20 public yalToken;
  IYALDistributor public yalDistributor;

  uint256 public defaultExchangeRate;
  uint256 public defaultMemberPeriodLimit;
  uint256 public totalPeriodLimit;

  // Caches
  uint256 public totalExchangedYal;

  // memberId => details
  mapping(bytes32 => Member) public members;

  // orderId => details
  mapping(uint256 => Order) public orders;

  modifier onlyFundManager() {
    require(hasRole(msg.sender, FUND_MANAGER_ROLE), "Only fund manager role allowed");

    _;
  }

  modifier onlyOperator() {
    require(hasRole(msg.sender, OPERATOR_ROLE), "Only operator role allowed");

    _;
  }

  modifier onlySuperOperator() {
    require(hasRole(msg.sender, SUPER_OPERATOR_ROLE), "Only super operator role allowed");

    _;
  }

  constructor() public {
  }

  function initialize(
    address _initialOwner,
    address _yalDistributor,
    address _yalToken,
    uint256 _defaultExchangeRate
  )
    initializeWithOwner(_initialOwner)
    external
  {
    require(_defaultExchangeRate > 0, "Default rate can't be 0");
    require(_yalDistributor != address(0), "YALDistributor address can't be 0");
    require(_yalToken != address(0), "YALToken address can't be 0");

    yalDistributor = IYALDistributor(_yalDistributor);
    yalToken = IERC20(_yalToken);

    defaultExchangeRate = _defaultExchangeRate;

    emit SetDefaultExchangeRate(msg.sender, _defaultExchangeRate);
  }

  function _handleRelayedCall(
    bytes memory _encodedFunction,
    address _caller
  )
    internal
    view
    returns (GSNRecipientSignatureErrorCodes, bytes memory)
  {
    bytes4 signature = getDataSignature(_encodedFunction);

    return (GSNRecipientSignatureErrorCodes.METHOD_NOT_SUPPORTED, "");
  }

  // FUND MANAGER INTERFACE

  /**
   * @dev Sets a default exchange rate
   * @param _defaultExchangeRate 100% == 100 ETH
   */
  function setDefaultExchangeRate(uint256 _defaultExchangeRate) external onlyFundManager {
    require(_defaultExchangeRate > 0, "Default rate can't be 0");

    defaultExchangeRate = _defaultExchangeRate;

    emit SetDefaultExchangeRate(msg.sender, _defaultExchangeRate);
  }

  /**
   * @dev Sets a particular member exchange rate by its id
   * @param _memberId to set exchange rate for
   * @param _customExchangeRate 100% == 100 ETH; set to 0 to disable custom rate and use the default one
   */
  function setCustomExchangeRate(bytes32 _memberId, uint256 _customExchangeRate) external onlyFundManager {
    members[_memberId].customExchangeRate = _customExchangeRate;

    emit SetCustomExchangeRate(msg.sender, _memberId, _customExchangeRate);
  }

  /**
   * @dev Sets a total period exchange limit for all users
   * @param _totalPeriodLimit in YAL
   */
  function setTotalPeriodLimit(uint256 _totalPeriodLimit) external onlyFundManager {
    totalPeriodLimit = _totalPeriodLimit;

    emit SetTotalPeriodLimit(msg.sender, _totalPeriodLimit);
  }

  /**
   * @dev Sets a member exchange limit for a period
   * @param _defaultMemberPeriodLimit in YAL; set to 0 to disable member limit
   */
  function setDefaultMemberPeriodLimit(uint256 _defaultMemberPeriodLimit) external onlyFundManager {
    defaultMemberPeriodLimit = _defaultMemberPeriodLimit;

    emit SetDefaultMemberPeriodLimit(msg.sender, _defaultMemberPeriodLimit);
  }

  /**
   * @dev Sets a particular member exchange limit for a period
   * @param _memberId to set limit for
   * @param _customPeriodLimit in YAL; set to 0 to disable custom limit and use the default one
   */
  function setCustomPeriodLimit(bytes32 _memberId, uint256 _customPeriodLimit) external onlyFundManager {
    members[_memberId].customPeriodLimit = _customPeriodLimit;

    emit SetCustomPeriodLimit(msg.sender, _memberId, _customPeriodLimit);
  }

  /**
   * @dev Withdraws almost all YAL tokens
   * It keeps a small percent of tokens to reduce gas cost for further transfer operations with this address using GSN.
   */
  function withdrawYALs() public onlyFundManager {
    uint256 _payout = yalToken.balanceOf(address(this));

    require(_payout > 0, "Nothing to withdraw");

    // NOTICE: will keep a small amount of YAL tokens
    yalToken.transfer(msg.sender, _payout.sub(ICoinToken(address(yalToken)).transferFee()));
  }

  // OPERATOR INTERFACE

  function closeOrder(uint256 _orderId, string calldata _paymentDetails) external onlyOperator {
    Order storage o = orders[_orderId];
    Member storage m = members[o.memberId];

    require(o.status == OrderStatus.OPEN, "Order should be open");

    uint256 currentPeriod = yalDistributor.getCurrentPeriodId();

    uint256 limit = m.customPeriodLimit;
    if (limit == 0) {
      limit = totalPeriodLimit;
    }

    if (limit > 0) {
      require(
        m.yalExchangedByPeriod[currentPeriod].add(o.yalAmount) <= limit,
        "Exchange amount exceeds the period limit"
      );
    }

    m.yalExchangedByPeriod[currentPeriod] = m.yalExchangedByPeriod[currentPeriod].add(o.yalAmount);

    o.status = OrderStatus.OPEN;
    o.paymentDetails = _paymentDetails;

    totalExchangedYal = totalExchangedYal.add(o.yalAmount);
    m.totalExchanged = m.totalExchanged.add(o.yalAmount);
    m.totalOpen = m.totalOpen.sub(o.yalAmount);

    emit CloseOrder(_orderId, msg.sender);

    yalToken.transferFrom(address(this), msg.sender, o.yalAmount);
  }

  function cancelOrder(uint256 _orderId, string calldata _cancelReason) external onlyOperator {
    Order storage o = orders[_orderId];
    Member storage m = members[o.memberId];

    require(o.status == OrderStatus.OPEN, "Order should be open");

    o.status = OrderStatus.CANCELLED;

    m.totalOpen = m.totalOpen.sub(o.yalAmount);

    emit CancelOrder(_orderId, msg.sender, _cancelReason);

    yalToken.transferFrom(address(this), yalDistributor.getMemberAddress(o.memberId), o.yalAmount);
  }

  // SUPER OPERATOR INTERFACE

  function voidOrder(uint256 _orderId) external onlySuperOperator {
    Order storage o = orders[_orderId];
    address memberAddress = yalDistributor.getMemberAddress(o.memberId);
    uint256 yalAmount = o.yalAmount;

    require(o.status == OrderStatus.CLOSED, "Order should be closed");

    totalExchangedYal = totalExchangedYal.sub(yalAmount);
    members[o.memberId].totalExchanged = members[o.memberId].totalExchanged.sub(yalAmount);

    o.status = OrderStatus.VOIDED;
    emit VoidOrder(_orderId, msg.sender);

    yalToken.transferFrom(msg.sender, memberAddress, yalAmount);
  }

  // USER INTERFACE

  function createOrder(uint256 _yalAmount) external {
    require(_yalAmount > 0, "YAL amount can't be 0");

    address memberAddress = _msgSender();

    require(yalDistributor.isActive(memberAddress));

    bytes32 memberId = yalDistributor.memberAddress2Id(memberAddress);

    require(_yalAmount <= calculateMaxYalToSell(memberId), "YAL amount exceeds the limit");

    uint256 rate = members[memberId].customExchangeRate;

    if (rate == 0) {
      rate = defaultExchangeRate;
    }

    uint256 buyAmount = _yalAmount.mul(rate).div(RATE_DIVIDER);

    uint256 orderId = nextId();
    Order storage o = orders[orderId];
    Member storage m = members[o.memberId];

    require(o.status == OrderStatus.NULL, "Invalid status");

    o.memberId = memberId;
    o.status = OrderStatus.OPEN;
    o.createdAt = now;
    o.buyAmount = buyAmount;

    m.totalOpen = m.totalOpen.add(_yalAmount);

    emit CreateOrder(orderId, memberId, _yalAmount, buyAmount);

    yalToken.transferFrom(msg.sender, address(this), _yalAmount);
  }

  // INTERNAL

  function nextId() internal returns (uint256) {
    idCounter += 1;
    return idCounter;
  }

  // GETTERS

  function calculateMaxYalToSell(bytes32 _memberId) public view returns(uint256) {
    uint256 totalClaimed = yalDistributor.getTotalClaimed(_memberId);
    Member storage m = members[_memberId];

    return totalClaimed
      .sub(m.totalExchanged)
      .sub(m.totalOpen)
      .add(m.totalVoided);
  }

  function getCustomExchangeRate(bytes32 _memberId) external view returns (uint256) {
    return members[_memberId].customExchangeRate;
  }

  function getCustomPeriodLimit(bytes32 _memberId) external view returns (uint256) {
    return members[_memberId].customPeriodLimit;
  }
}
