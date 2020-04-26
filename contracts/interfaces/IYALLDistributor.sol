/*
 * Copyright ©️ 2020 Galt•Project Society Construction and Terraforming Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka)
 *
 * Copyright ©️ 2020 Galt•Core Blockchain Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka) by
 * [Basic Agreement](ipfs/QmaCiXUmSrP16Gz8Jdzq6AJESY1EAANmmwha15uR3c1bsS)).
 */

pragma solidity ^0.5.13;

/**
 * @title YALLDistributor contract
 * @author Galt Project
 * @notice Mints YALL tokens on request according pre-configured formula
 **/
interface IYALLDistributor {
  function member(bytes32 _memberId)
    external
    view
    returns(
      bool active,
      address addr,
      uint256 createdAt,
      uint256 lastEnabledAt,
      uint256 lastDisabledAt,
      uint256 totalClaimed
    );

  function period(uint256 _periodId) external view returns(uint256 rewardPerMember, uint256 verifierReward, bool verifierClaimedReward);

  function activeMemberCount() external view returns(uint256);
  function memberAddress2Id(address _memberAddress) external view returns(bytes32);


  function claimFundsMultiple(address[] calldata _memberAddresses) external;
  function claimFunds() external;

  // VIEW METHODS

  function getCurrentPeriodId() external view returns (uint256);
  function getPreviousPeriodBeginsAt() external view returns (uint256);
  function getNextPeriodBeginsAt() external view returns (uint256);
  function getCurrentPeriodBeginsAt() external view returns (uint256);
  function getActiveAddressList() external view returns (address[] memory);

  function getActiveAddressSize() external view returns (uint256);

  function isCurrentPeriodClaimedByMember(bytes32 _memberId) external view returns (bool);

  function isCurrentPeriodClaimedByAddress(address _memberAddress) external view returns (bool);

  function isPeriodClaimedByMember(bytes32 _memberId, uint256 _periodId) external view returns (bool);

  function isPeriodClaimedByAddress(address _memberAddress, uint256 _periodId) external view returns (bool);

  function isActive(address _addr) external view returns (bool);

  function getTotalClaimed(bytes32 _memberId) external view returns (uint256);

  function getMemberAddress(bytes32 _memberId) external view returns (address);

  function getMemberByAddress(address _memberAddress) external view returns (
    bytes32 id,
    bool active,
    address addr,
    uint256 createdAt,
    uint256 lastEnabledAt,
    uint256 lastDisabledAt,
    uint256 totalClaimed
  );
}
