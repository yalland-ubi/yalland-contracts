/*
 * Copyright ©️ 2018 Galt•Project Society Construction and Terraforming Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka)
 *
 * Copyright ©️ 2018 Galt•Core Blockchain Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka) by
 * [Basic Agreement](ipfs/QmaCiXUmSrP16Gz8Jdzq6AJESY1EAANmmwha15uR3c1bsS)).
 */

pragma solidity ^0.5.13;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20Mintable.sol";
import "@openzeppelin/contracts/ownership/Ownable.sol";

import "@galtproject/libs/contracts/collections/ArraySet.sol";
import "@galtproject/libs/contracts/traits/Permissionable.sol";

import "./interfaces/ICoinToken.sol";


library CityLibrary {
  struct MemberTariff {
    bool active;
    uint256 lastTimestamp;
    uint256 minted;
    uint256 claimed;
  }
  struct ParticipationRequest {
    bool sent;
    bool confirmed;
    uint256 confirmationsCount;
    mapping (address => bool) confirmations;
  }
  struct Tariff {
    string title;
    bool active;
    uint256 payment;
    uint256 paymentPeriod;
    uint256 paymentSent;
    uint256 totalMinted;
    uint256 totalBurned;
    uint256 mintForPeriods;
    TariffCurrency currency;
    address currencyAddress;
    ArraySet.AddressSet activeParticipants;
  }
  enum TariffCurrency {
    ETH,
    ERC20
  }
}
