/*
 * Copyright ©️ 2020 Galt•Project Society Construction and Terraforming Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka)
 *
 * Copyright ©️ 2020 Galt•Core Blockchain Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka) by
 * [Basic Agreement](ipfs/QmaCiXUmSrP16Gz8Jdzq6AJESY1EAANmmwha15uR3c1bsS)).
 */

pragma solidity ^0.5.17;

import "./interfaces/IYALLDistributor.sol";
import "./YALLEmissionRewardPoolCore.sol";

/**
 * @title YALLEmissionRewardPool contract
 * @author Galt Project
 * @notice Accounts emission distribution among the project delegators and verifiers
 **/
contract YALLEmissionRewardPool is YALLEmissionRewardPoolCore {
  modifier triggerTransition() {
    handlePeriodTransitionIfRequired();
    _;
  }

  constructor() public {}

  function initialize(
    address _yallRegistry,
    uint256 _delegatorsShare,
    uint256 _verifiersShare
  ) external initializer {
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

    uint256 activeVerifierCount = _yallVerification().getActiveVerifierCount();
    require(activeVerifierCount > 0, "YALLEmissionRewardPool: Doesn't support 0 verifier count");

    period.verifierReward = period.totalVerifiersReward / activeVerifierCount;

    period.transitionHandled = true;
  }

  // EMISSION REWARD POOL MANAGER INTERFACE
  function setShares(uint256 _delegatorsShare, uint256 _verifiersShare) external onlyEmissionRewardPoolManager {
    _setShares(_delegatorsShare, _verifiersShare);
  }

  // DELEGATOR INTERFACE
  function claimDelegatorReward(uint256 _periodId) external triggerTransition {
    require(
      delegatorClaimedPeriods[_periodId][msg.sender] == false,
      "YALLEmissionRewardPool: Already claimed for the current period"
    );

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

    Period storage period = periods[currentPeriodId];

    requireVerifierCanClaimReward(msg.sender);

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

  // REQUIRES
  function requireVerifierCanClaimReward(address _verifier) public view {
    uint256 currentPeriodId = _yallDistributor().getCurrentPeriodId();

    require(
      verifierClaimedPeriods[currentPeriodId][_verifier] == false,
      "YALLEmissionRewardPool: Already claimed for the current period"
    );

    (bool active, uint256 createdAt, uint256 lastEnabledAt, uint256 lastDisabledAt) = _yallVerification().verifiers(
      _verifier
    );

    _requireCanClaimReward(
      active,
      currentPeriodId,
      _yallDistributor().getCurrentPeriodBeginsAt(),
      createdAt,
      lastEnabledAt,
      lastDisabledAt
    );
  }

  // GETTERS
  function getPeriodTotalDelegatorsReward(uint256 _periodId) external view returns (uint256) {
    return periods[_periodId].totalDelegatorsReward;
  }

  function getPeriodTotalVerifiersReward(uint256 _periodId) external view returns (uint256) {
    return periods[_periodId].totalVerifiersReward;
  }
}
