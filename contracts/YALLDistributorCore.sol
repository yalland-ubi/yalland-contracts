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
import "@openzeppelin/contracts/utils/EnumerableSet.sol";
import "@openzeppelin/upgrades/contracts/Initializable.sol";
import "./interfaces/IYALLToken.sol";
import "./interfaces/IYALLDistributor.sol";
import "./GSNRecipientSigned.sol";
import "./registry/YALLRegistryHelpers.sol";
import "./traits/ACLPausable.sol";


/**
 * @title YALLDistributor contract
 * @author Galt Project
 * @notice YALLDistributor Data Structure
 **/
contract YALLDistributorCore is
  Initializable,
  YALLRegistryHelpers,
  ACLPausable
{
  using SafeMath for uint256;
  using EnumerableSet for EnumerableSet.AddressSet;

  uint256 public constant HUNDRED_PCT = 100 ether;

  event ActiveMemberCountChanged(uint256 activeMemberCount);
  event AddMember(bytes32 memberId, address memberAddress);
  event ChangeMemberAddress(bytes32 indexed memberId, address from, address to);
  event ChangeMyAddress(bytes32 indexed memberId, address from, address to);
  event ClaimFunds(bytes32 indexed memberId, address indexed addr, uint256 indexed periodId, uint256 amount);
  event DistributeEmissionPoolReward(uint256 indexed periodId, address indexed to, uint256 amount);
  event EnableMember(bytes32 indexed memberId, address indexed memberAddress);
  event DisableMember(bytes32 indexed memberId, address indexed memberAddress);
  event PeriodChange(
    uint256 newPeriodId,
    uint256 volume,
    uint256 rewardPerMember,
    uint256 emissionPoolReward,
    uint256 activeMemberCount
  );
  event SetGsnFee(uint256 value);
  event SetPeriodVolume(uint256 oldPeriodVolume, uint256 newPeriodVolume);
  event SetEmissionPoolRewardShare(uint256 rewardShare);

  struct Period {
    uint256 rewardPerMember;
    uint256 emissionPoolRewardTotal;
    uint256 emissionPoolRewardClaimed;
  }

  struct Member {
    bool active;
    address addr;
    uint256 createdAt;
    uint256 lastEnabledAt;
    uint256 lastDisabledAt;
    uint256 totalClaimed;
    // periodId => claimed
    mapping(uint256 => bool) claimedPeriods;
  }

  uint256 public genesisTimestamp;
  uint256 public periodLength;
  uint256 public periodVolume;

  uint256 public activeMemberCount;

  // 100% == 100 ether
  uint256 public emissionPoolRewardShare;
  // in YALL wei
  uint256 public gsnFee;

  // credentialsHash => memberDetails
  mapping(bytes32 => Member) public member;
  mapping(address => bytes32) public memberAddress2Id;

  // periodId => periodDetails
  mapping(uint256 => Period) public period;

  EnumerableSet.AddressSet internal activeAddressesCache;
}
