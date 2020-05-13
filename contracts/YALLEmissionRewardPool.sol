/*
 * Copyright ©️ 2020 Galt•Project Society Construction and Terraforming Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka)
 *
 * Copyright ©️ 2020 Galt•Core Blockchain Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka) by
 * [Basic Agreement](ipfs/QmaCiXUmSrP16Gz8Jdzq6AJESY1EAANmmwha15uR3c1bsS)).
 */

pragma solidity ^0.5.13;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/upgrades/contracts/Initializable.sol";
import "./interfaces/IYALLDistributor.sol";
import "./registry/YALLRegistryHelpers.sol";
import "./traits/ACLPausable.sol";
import "./traits/YALLRewardClaimer.sol";


/**
 * @title YALLEmissionRewardPool contract
 * @author Galt Project
 * @notice Accounts emission distribution among the project delegators and verifiers
 **/
contract YALLEmissionRewardPool is
  Initializable,
  YALLRegistryHelpers,
  ACLPausable,
  YALLRewardClaimer
{
  using SafeMath for uint256;

  uint256 public constant RATE_DIVIDER = 100 ether;

  event SetShares(uint256 delegatorsShare, uint256 verifiersShare);
  event ClaimDelegatorReward(
    address indexed delegator,
    uint256 indexed periodId,
    uint256 amount,
    uint256 stakeBalance,
    uint256 stakeTotalSupply
  );
  event ClaimVerifierReward(address indexed verifier, uint256 indexed periodId, uint256 amount);

  struct Period {
    bool transitionHandled;
    uint256 totalReward;
    uint256 totalVerifiersReward;
    uint256 totalDelegatorsReward;
    uint256 verifierReward;
  }

  // (periodId => (delegatorAddress => claimed ))
  mapping(uint256 => mapping(address => bool)) public delegatorClaimedPeriods;
  // (periodId => (verifierAddress => claimed ))
  mapping(uint256 => mapping(address => bool)) public verifierClaimedPeriods;

  // 100% == 100 eth
  uint256 public delegatorsShare;
  // 100% == 100 eth
  uint256 public verifiersShare;

  // period => totalReward
  mapping(uint256 => Period) public periods;

  modifier triggerTransition() {
    handlePeriodTransitionIfRequired();
    _;
  }

  constructor() public {
  }

  function initialize(
    address _yallRegistry,
    uint256 _delegatorsShare,
    uint256 _verifiersShare
  )
    external
    initializer
  {
    yallRegistry = YALLRegistry(_yallRegistry);
    _setShares(_delegatorsShare, _verifiersShare);
  }

  // PERMISSIONLESS INTERFACE
  function handlePeriodTransitionIfRequired() public {
    uint256 currentPeriodId = _yallDistributor().getCurrentPeriodId();
    Period storage period = periods[currentPeriodId];

    if (period.transitionHandled == true) {
      return;
    }

    _yallDistributor().handlePeriodTransitionIfRequired();
    uint256 totalReward = _yallDistributor().getPeriodEmissionReward(currentPeriodId);

    period.totalReward = totalReward;
    // period.totalVerifiersReward = totalReward * verifiersShare / RATE_DIVIDER;
    period.totalVerifiersReward = totalReward.mul(verifiersShare) / RATE_DIVIDER;
    // period.totalDelegatorsReward = totalReward * delegatorsShare / RATE_DIVIDER;
    period.totalDelegatorsReward = totalReward.mul(delegatorsShare) / RATE_DIVIDER;

    uint256 activeVerifierCount = _yallVerification().activeVerifierCount();
    require(activeVerifierCount > 0, "YALLEmissionRewardPool: Doesn't support 0 verifier count");

    period.verifierReward = period.totalVerifiersReward / activeVerifierCount;

    period.transitionHandled = true;
  }

  // EMISSION REWARD POOL MANAGER INTERFACE
  function setShares(uint256 _delegatorsShare, uint256 _verifiersShare) external onlyEmissionRewardPoolManager {
    _setShares(_delegatorsShare, _verifiersShare);
  }

  // DELEGATOR INTERFACE
  function claimDelegatorReward(uint256 _periodId) external {
    require(delegatorClaimedPeriods[_periodId][msg.sender] == false, "YALLEmissionRewardPool: Already claimed for the current period");

    uint256 periodBeginsAt = _yallDistributor().getPeriodBeginsAt(_periodId);
    uint256 balance = _homeMediator().balanceOfAt(msg.sender, periodBeginsAt);
    uint256 totalSupply = _homeMediator().totalSupplyAt(periodBeginsAt);
    require(balance > 0, "YALLEmissionRewardPool: Delegate balance is 0 for given period");
    require(totalSupply > 0, "YALLEmissionRewardPool: Total supply is 0 for given period");

    // periods[_periodId].totalDelegatorsReward * (balance / totalSupply)
    uint256 toTransfer = periods[_periodId].totalDelegatorsReward.mul(balance).div(totalSupply);
    require(toTransfer > 0, "YALLEmissionRewardPool: Calculated  reward is 0");

    delegatorClaimedPeriods[_periodId][msg.sender] = true;

    emit ClaimDelegatorReward(msg.sender, _periodId, toTransfer, balance, totalSupply);

    _yallDistributor().distributeEmissionPoolReward(_periodId, msg.sender, toTransfer);
  }

  // VERIFIER INTERFACE
  function claimVerifierReward() external triggerTransition {
    IYALLDistributor dist = _yallDistributor();
    uint256 currentPeriodId = dist.getCurrentPeriodId();
    uint256 currentPeriodStart = dist.getCurrentPeriodBeginsAt();

    Period storage period = periods[currentPeriodId];

    require(verifierClaimedPeriods[currentPeriodId][msg.sender] == false, "YALLEmissionRewardPool: Already claimed for the current period");

    (bool active, , uint256 createdAt, uint256 lastEnabledAt, uint256 lastDisabledAt) = _yallVerification().verifiers(msg.sender);

    requireCanClaimReward(active, currentPeriodId, currentPeriodStart, createdAt, lastEnabledAt, lastDisabledAt);

    verifierClaimedPeriods[currentPeriodId][msg.sender] = true;

    emit ClaimVerifierReward(msg.sender, currentPeriodId, period.verifierReward);

    _yallDistributor().distributeEmissionPoolReward(currentPeriodId, msg.sender, period.verifierReward);
  }

  // INTERNAL METHODS
  function _setShares(uint256 _delegatorsShare, uint256 _verifiersShare) internal {
    require(_delegatorsShare.add(_verifiersShare) == 100 ether, "YALLEmissionRewardPool: Shares sum should be 100eth");

    delegatorsShare = _delegatorsShare;
    verifiersShare = _verifiersShare;

    emit SetShares(_delegatorsShare, _verifiersShare);
  }

  // GETTERS
  function getPeriodTotalDelegatorsReward(uint256 _periodId) external view returns (uint256) {
    return periods[_periodId].totalDelegatorsReward;
  }

  function getPeriodTotalVerifiersReward(uint256 _periodId) external view returns (uint256) {
    return periods[_periodId].totalVerifiersReward;
  }
}
