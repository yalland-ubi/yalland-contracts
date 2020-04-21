/*
 * Copyright ©️ 2018 Galt•Project Society Construction and Terraforming Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka)
 *
 * Copyright ©️ 2018 Galt•Core Blockchain Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka) by
 * [Basic Agreement](ipfs/QmaCiXUmSrP16Gz8Jdzq6AJESY1EAANmmwha15uR3c1bsS)).
 */

pragma solidity ^0.5.13;

import "../CityLibrary.sol";


interface ICity {
  function() external payable;

  function createTariff(
    string calldata _title,
    uint256 _payment,
    uint256 _paymentPeriod,
    uint256 _mintForPeriods,
    CityLibrary.TariffCurrency _currency,
    address _currencyAddress
  )
  external
  returns (bytes32);

  function setTariffActive(bytes32 _id, bool _active) external;

  function editTariff(
    bytes32 _id,
    string calldata _title,
    uint256 _payment,
    uint256 _paymentPeriod,
    uint256 _mintForPeriods,
    CityLibrary.TariffCurrency _currency,
    address _currencyAddress
  ) external;

  function setMaxSupply(uint256 _maxSupply) external;

  function setConfirmsToParticipation(uint256 _confirmsToParticipation) external;

  function claimPayment(address _claimFor, bytes32 _tariffId, uint256 _periodsNumber) external returns (uint256 nextDate);

  function addParticipation(address _address, bytes32 _tariff) external;

  function requestParticipation(bytes32 _tariffId) external;

  function confirmParticipation(address _requested, bytes32 _tariffId) external returns (uint256 count);

  function confirmsOf(address _requested, bytes32 _tariffId) external view returns (uint256);

  function kickAllParticipation(address _member) external;

  function leaveAllParticipation() external;

  function kickTariffParticipation(address _member, bytes32 _tariffId) external;

  function leaveAllParticipation(bytes32 _tariffId) external;

  function addRoleTo(address _operator, string calldata _role) external;

  function removeRoleFrom(address _operator, string calldata _role) external;

  function getAllTariffs() external view returns (bytes32[] memory);

  function getActiveTariffs() external view returns (bytes32[] memory);

  function getTariff(bytes32 _id) external view returns (
    string memory title,
    bool active,
    uint256 payment,
    uint256 paymentPeriod,
    uint256 mintForPeriods,
    uint256 totalMinted,
    uint256 totalBurned,
    uint256 paymentSent,
    CityLibrary.TariffCurrency currency,
    address currencyAddress
  );

  function getAllParticipants() external view returns (address[] memory);

  function getActiveParticipants() external view returns (address[] memory);

  function getActiveParticipantsCount() external view returns (uint256);

  function getTariffActiveParticipants(bytes32 _tariffId) external view returns (address[] memory);

  function getTariffActiveParticipantsCount(bytes32 _tariffId) external view returns (uint256);

  function isParticipant(address _address) external view returns (bool);

  function getParticipantInfo(address _member) external view returns (
    bool active,
    bytes32[] memory tariffs
  );

  function getParticipantTariffInfo(address _member, bytes32 _tariff) external view returns (
    bool active,
    uint256 claimed,
    uint256 minted,
    uint256 lastTimestamp);
}
