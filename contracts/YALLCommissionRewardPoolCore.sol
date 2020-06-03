/*
 * Copyright ©️ 2020 Galt•Project Society Construction and Terraforming Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka)
 *
 * Copyright ©️ 2020 Galt•Core Blockchain Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka) by
 * [Basic Agreement](ipfs/QmaCiXUmSrP16Gz8Jdzq6AJESY1EAANmmwha15uR3c1bsS)).
 */

pragma solidity ^0.5.17;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/utils/EnumerableSet.sol";
import "@openzeppelin/upgrades/contracts/Initializable.sol";
import "./interfaces/IYALLDistributor.sol";
import "./registry/YALLRegistryHelpers.sol";
import "./traits/ACLPausable.sol";
import "./traits/YALLRewardClaimer.sol";

/**
 * @title YALLCommissionRewardPoolCore contract
 * @author Galt Project
 * @notice YALLCommissionRewardPool Data Structure
 **/
contract YALLCommissionRewardPoolCore is Initializable, YALLRegistryHelpers, ACLPausable, YALLRewardClaimer {
  using SafeMath for uint256;
  using EnumerableSet for EnumerableSet.AddressSet;

  uint256 public constant RATE_DIVIDER = 100 ether;

  event SetSources(address[] sources);
  event SetShares(uint256 delegatorsShare, uint256 verifiersShare, uint256 membersShare);
  event ClaimDelegatorReward(
    address indexed delegator,
    uint256 indexed periodId,
    uint256 amount,
    uint256 stakeBalance,
    uint256 stakeTotalSupply
  );
  event ClaimVerifierReward(address indexed verifier, uint256 indexed periodId, uint256 amount);
  event ClaimMemberReward(address indexed verifier, uint256 indexed periodId, uint256 amount);
  event PeriodChange(
    uint256 newPeriodId,
    uint256 totalReward,
    uint256 totalDelegatorsReward,
    uint256 totalVerifiersReward,
    uint256 totalMembersReward,
    uint256 previousUnclaimedVerifiersReward,
    uint256 previousUnclaimedMembersReward,
    uint256 verifierReward,
    uint256 memberReward,
    uint256 activeVerifierCount,
    uint256 activeMemberCount
  );
  event WithdrawFees(uint256 amount, uint256 timestamp, address[] sources);

  struct Period {
    bool transitionHandled;
    uint256 totalReward;
    uint256 totalVerifiersReward;
    uint256 totalDelegatorsReward;
    uint256 totalMembersReward;
    uint256 claimedVerifiersReward;
    uint256 claimedMembersReward;
    uint256 verifierReward;
    uint256 memberReward;
  }

  // (periodId => (delegatorAddress => claimed ))
  mapping(uint256 => mapping(address => bool)) public delegatorClaimedPeriods;
  // (periodId => (verifierAddress => claimed ))
  mapping(uint256 => mapping(address => bool)) public verifierClaimedPeriods;
  // (periodId => (verifierAddress => claimed ))
  mapping(uint256 => mapping(address => bool)) public memberClaimedPeriods;

  // 100% == 100 eth
  uint256 public delegatorsShare;
  // 100% == 100 eth
  uint256 public verifiersShare;
  // 100% == 100 eth
  uint256 public membersShare;

  // period => totalReward
  mapping(uint256 => Period) public periods;
  address[] public sources;
}
