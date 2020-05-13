/*
 * Copyright ©️ 2020 Galt•Project Society Construction and Terraforming Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka)
 *
 * Copyright ©️ 2020 Galt•Core Blockchain Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka) by
 * [Basic Agreement](ipfs/QmaCiXUmSrP16Gz8Jdzq6AJESY1EAANmmwha15uR3c1bsS)).
 */

pragma solidity ^0.5.13;


interface IYALLDistributor {
  // CONSTANTS
  // solhint-disable-next-line func-name-mixedcase
  function HUNDRED_PCT() external pure returns (uint256);

  // PUBLIC VARIABLES
  function genesisTimestamp() external returns (uint256);
  function periodLength() external returns (uint256);
  function periodVolume() external returns (uint256);
  function activeMemberCount() external returns (uint256);
  function emissionPoolRewardShare() external returns (uint256);
  function gsnFee() external returns (uint256);

  // PUBLIC MAPPINGS
  function member(bytes32 _memberId)
    external
    view
    returns (
      bool active,
      address addr,
      uint256 createdAt,
      uint256 lastEnabledAt,
      uint256 lastDisabledAt,
      uint256 totalClaimed
    );
  function period(uint256 _periodId)
    external
    view
    returns (
      uint256 rewardPerMember,
      uint256 verifierReward,
      bool verifierClaimedReward
    );
  function memberAddress2Id(address _memberAddress) external view returns(bytes32);

  // DISTRIBUTOR MANAGER INTERFACE
  function setEmissionPoolRewardShare(uint256 _emissionPoolRewardShare) external;
  function setPeriodVolume(uint256 _periodVolume) external;

  // FEE MANAGER INTERFACE
  function setGsnFee(uint256 _gsnFee) external;

  // FEE CLAIMER INTERFACE
  function withdrawFee() external;

  // VERIFIER INTERFACE
  function claimFundsMultiple(address[] calldata _memberAddresses) external;

  // MEMBER INTERFACE
  function claimFunds() external;
  function changeMyAddress(address _to) external;

  // EMISSION CLAIMER INTERFACE

  function distributeEmissionPoolReward(uint256 _periodId, address _to, uint256 _amount) external;

  // PERMISSIONLESS INTERFACE
  function handlePeriodTransitionIfRequired() external;

  // GETTERS
  function requireCanClaimFundsByAddress(address _memberAddress) external view;
  function getCurrentPeriodId() external view returns (uint256);
  function getPreviousPeriodBeginsAt() external view returns (uint256);
  function getNextPeriodBeginsAt() external view returns (uint256);
  function getCurrentPeriodBeginsAt() external view returns (uint256);
  function getPeriodBeginsAt(uint256 _periodId) external view returns (uint256);
  function getActiveAddressList() external view returns (address[] memory);
  function getActiveAddressSize() external view returns (uint256);
  function isCurrentPeriodClaimedByMember(bytes32 _memberId) external view returns (bool);
  function isCurrentPeriodClaimedByAddress(address _memberAddress) external view returns (bool);
  function isPeriodClaimedByMember(bytes32 _memberId, uint256 _periodId) external view returns (bool);
  function isPeriodClaimedByAddress(address _memberAddress, uint256 _periodId) external view returns (bool);
  function isActive(address _addr) external view returns (bool);
  function getPeriodEmissionReward(uint256 _periodId) external view returns (uint256);
  function getTotalClaimed(bytes32 _memberId) external view returns (uint256);
  function getMemberAddress(bytes32 _memberId) external view returns (address);
  function getMemberByAddress(address _memberAddress)
    external
    view
    returns (
      bytes32 id,
      bool active,
      address addr,
      uint256 createdAt,
      uint256 lastEnabledAt,
      uint256 lastDisabledAt,
      uint256 totalClaimed
    );
}
