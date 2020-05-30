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
import "./interfaces/IYALLFeeWithdrawable.sol";
import "./YALLCommissionRewardPoolCore.sol";


/**
 * @title YALLCommissionRewardPool contract
 * @author Galt Project
 * @notice Collects fees and distributes them among the project delegators, verifiers and members
 **/
contract YALLCommissionRewardPool is YALLCommissionRewardPoolCore {
  modifier triggerTransition() {
    handlePeriodTransitionIfRequired();
    _;
  }

  constructor() public {
  }

  function initialize(
    address _yallRegistry,
    uint256 _delegatorsShare,
    uint256 _verifiersShare,
    uint256 _membersShare
  )
    external
    initializer
  {
    yallRegistry = YALLRegistry(_yallRegistry);
    _setShares(_delegatorsShare, _verifiersShare, _membersShare);
  }

  // PERMISSIONLESS INTERFACE
  function handlePeriodTransitionIfRequired() public {
    uint256 currentPeriodId = _yallDistributor().getCurrentPeriodId();
    Period storage period = periods[currentPeriodId];

    if (period.transitionHandled == true) {
      return;
    }

    uint256 previousNotClaimedVerifiersReward = 0;
    uint256 previousNotClaimedMembersReward = 0;

    if (currentPeriodId > 0) {
      Period storage pp = periods[currentPeriodId - 1];

      previousNotClaimedVerifiersReward = pp.totalVerifiersReward.sub(pp.claimedVerifiersReward);
      previousNotClaimedMembersReward = pp.totalMembersReward.sub(pp.claimedMembersReward);
    }

    uint256 totalPeriodReward = _withdrawFees();

    period.totalReward = totalPeriodReward;
    // period.totalDelegatorsReward = totalReward * delegatorsShare / RATE_DIVIDER;
    period.totalDelegatorsReward = totalPeriodReward.mul(delegatorsShare) / RATE_DIVIDER;

    // currentVerifiersReward = totalReward * verifiersShare / RATE_DIVIDER;
    uint256 currentVerifiersReward = totalPeriodReward.mul(verifiersShare) / RATE_DIVIDER;
    // currentMembersReward = totalReward * membersShare / RATE_DIVIDER;
    uint256 currentMembersReward = totalPeriodReward.mul(membersShare) / RATE_DIVIDER;
    period.totalVerifiersReward = currentVerifiersReward.add(previousNotClaimedVerifiersReward);
    period.totalMembersReward = currentMembersReward.add(previousNotClaimedMembersReward);

    uint256 activeVerifierCount = _yallVerification().activeVerifierCount();
    uint256 activeMemberCount = _yallDistributor().activeMemberCount();

    require(activeVerifierCount > 0, "YALLCommissionRewardPool: Doesn't support 0 verifier count");
    require(activeMemberCount > 0, "YALLCommissionRewardPool: Doesn't support 0 member count");

    uint256 verifierReward = period.totalVerifiersReward / activeVerifierCount;
    uint256 memberReward = period.totalMembersReward / activeMemberCount;

    period.verifierReward = verifierReward;
    period.memberReward = memberReward;

    emit PeriodChange(
      currentPeriodId,
      totalPeriodReward,
      period.totalDelegatorsReward,
      period.totalVerifiersReward,
      period.totalMembersReward,
      previousNotClaimedVerifiersReward,
      previousNotClaimedMembersReward,
      verifierReward,
      memberReward,
      activeVerifierCount,
      activeMemberCount
    );

    period.transitionHandled = true;
  }

  // COMMISSION REWARD POOL MANAGER INTERFACE

  function setSources(address[] calldata _sources) external onlyCommissionRewardPoolManager {
    sources = _sources;
    emit SetSources(_sources);
  }

  function setShares(
    uint256 _delegatorsShare,
    uint256 _verifiersShare,
    uint256 _membersShare
  )
    external
    onlyCommissionRewardPoolManager
  {
    _setShares(_delegatorsShare, _verifiersShare, _membersShare);
  }

  // DELEGATOR INTERFACE
  function claimDelegatorReward(uint256 _periodId) external triggerTransition {
    require(delegatorClaimedPeriods[_periodId][msg.sender] == false, "YALLCommissionRewardPool: Already claimed for the current period");

    Period storage period = periods[_periodId];
    uint256 periodBeginsAt = _yallDistributor().getPeriodBeginsAt(_periodId);
    uint256 balance = _homeMediator().balanceOfAt(msg.sender, periodBeginsAt);
    uint256 totalSupply = _homeMediator().totalSupplyAt(periodBeginsAt);
    require(balance > 0, "YALLCommissionRewardPool: Delegate balance is 0 for given period");
    require(totalSupply > 0, "YALLCommissionRewardPool: Total supply is 0 for given period");

    // periods[_periodId].totalDelegatorsReward * (balance / totalSupply)
    uint256 grossReward = period.totalDelegatorsReward.mul(balance).div(totalSupply);
    require(grossReward > 0, "YALLCommissionRewardPool: Calculated gross reward is 0");

    delegatorClaimedPeriods[_periodId][msg.sender] = true;

    uint256 netReward = _yallToken().deductTransferFee(grossReward);
    require(netReward > 0, "YALLCommissionRewardPool: Calculated net reward is 0");
    emit ClaimDelegatorReward(msg.sender, _periodId, grossReward, netReward, balance, totalSupply);

    _yallTokenIERC20().transfer(msg.sender, netReward);
  }

  // VERIFIER INTERFACE
  function claimVerifierReward() external triggerTransition {
    IYALLDistributor dist = _yallDistributor();
    uint256 currentPeriodId = dist.getCurrentPeriodId();

    Period storage period = periods[currentPeriodId];

    requireVerifierCanClaimReward(msg.sender);

    uint256 grossReward = period.verifierReward;

    period.claimedVerifiersReward = period.claimedVerifiersReward.add(grossReward);
    require(
      period.claimedVerifiersReward <= period.totalVerifiersReward,
      "YALLCommissionRewardPool: Total claimed exceeds max due an unknown reason"
    );

    verifierClaimedPeriods[currentPeriodId][msg.sender] = true;

    uint256 netReward = _yallToken().deductTransferFee(grossReward);
    require(netReward > 0, "YALLCommissionRewardPool: Calculated net reward is 0");

    emit ClaimVerifierReward(msg.sender, currentPeriodId, grossReward, netReward);

    _yallTokenIERC20().transfer(msg.sender, netReward);
  }

  // MEMBER INTERFACE
  function claimMemberReward() external triggerTransition {
    IYALLDistributor dist = _yallDistributor();
    uint256 currentPeriodId = dist.getCurrentPeriodId();

    Period storage period = periods[currentPeriodId];

    requireMemberCanClaimReward(msg.sender);

    uint256 grossReward = period.memberReward;

    period.claimedMembersReward = period.claimedMembersReward.add(grossReward);
    require(
      period.claimedMembersReward <= period.totalMembersReward,
      "YALLCommissionRewardPool: Total claimed exceeds max due an unknown reason"
    );

    memberClaimedPeriods[currentPeriodId][msg.sender] = true;

    uint256 netReward = _yallToken().deductTransferFee(grossReward);
    require(netReward > 0, "YALLCommissionRewardPool: Calculated net reward is 0");
    emit ClaimMemberReward(msg.sender, currentPeriodId, grossReward, netReward);

    _yallTokenIERC20().transfer(msg.sender, netReward);
  }

  // INTERNAL METHODS
  function _setShares(uint256 _delegatorsShare, uint256 _verifiersShare, uint256 _membersShare) internal {
    require(
      _delegatorsShare.add(_verifiersShare).add(_membersShare) == 100 ether,
      "YALLCommissionRewardPool: Shares sum should be 100eth"
    );

    delegatorsShare = _delegatorsShare;
    verifiersShare = _verifiersShare;
    membersShare = _membersShare;

    emit SetShares(_delegatorsShare, _verifiersShare, _membersShare);
  }

  // @dev YALL transfer fees are accounted within the diff variable
  function _withdrawFees() internal returns (uint256) {
    uint256 len = sources.length;

    uint256 balanceBefore = _yallTokenIERC20().balanceOf(address(this));

    for (uint256 i = 0; i < len; i++) {
      IYALLFeeWithdrawable(sources[i]).withdrawFee();
    }

    uint256 balanceAfter = _yallTokenIERC20().balanceOf(address(this));
    uint256 diff = balanceAfter.sub(balanceBefore);

    emit WithdrawFees(diff, now, sources);

    return diff;
  }

  // REQUIRES
  function requireVerifierCanClaimReward(address _verifier) public view {
    uint256 currentPeriodId = _yallDistributor().getCurrentPeriodId();

    require(
      verifierClaimedPeriods[currentPeriodId][_verifier] == false,
      "YALLCommissionRewardPool: Already claimed for the current period"
    );

    (
      bool active,
      ,
      uint256 createdAt,
      uint256 lastEnabledAt,
      uint256 lastDisabledAt
    ) = _yallVerification().verifiers(_verifier);

    _requireCanClaimReward(
      active,
      currentPeriodId,
      _yallDistributor().getCurrentPeriodBeginsAt(),
      createdAt,
      lastEnabledAt,
      lastDisabledAt
    );
  }

  function requireMemberCanClaimReward(address _member) public view {
    uint256 currentPeriodId = _yallDistributor().getCurrentPeriodId();

    require(
      memberClaimedPeriods[currentPeriodId][_member] == false,
      "YALLCommissionRewardPool: Already claimed for the current period"
    );

    (
      ,
      bool active,
      ,
      uint256 createdAt,
      uint256 lastEnabledAt,
      uint256 lastDisabledAt,
    ) = _yallDistributor().getMemberByAddress(_member);

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
