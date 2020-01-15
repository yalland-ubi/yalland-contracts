/*
 * Copyright ©️ 2018 Galt•Project Society Construction and Terraforming Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka)
 *
 * Copyright ©️ 2018 Galt•Core Blockchain Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka) by
 * [Basic Agreement](ipfs/QmaCiXUmSrP16Gz8Jdzq6AJESY1EAANmmwha15uR3c1bsS)).
 */

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@galtproject/libs/contracts/traits/Permissionable.sol";
import "./City.sol";
import "./interfaces/ICoinToken.sol";


contract AddressUpgrader is Permissionable {
  using SafeMath for uint256;

  string public constant SUPERUSER_ROLE = "superuser";

  event MigrateMyAddress(address indexed from, address indexed to, bytes32 indexed tariff);
  event ChangeAddress(address indexed from, address indexed to, bytes32 indexed tariff, address superuser);

  City public dcity;
  address public erc20Token;

  modifier onlySuperuser() {
    require(hasRole(msg.sender, SUPERUSER_ROLE), "Only superuser allowed");
    _;
  }

  constructor(address payable _dcity, address _erc20Token) public Permissionable() {
    dcity = City(_dcity);
    erc20Token = _erc20Token;
  }

  // @dev User migrates to a new address
  // @param _to address to migrate to
  function migrateMyAddress(address _to, bytes32 _tariff) external {
    _migrate(msg.sender, _to, _tariff);
    emit MigrateMyAddress(msg.sender, _to, _tariff);
  }

  function migrateUserAddress(address _from, address _to, bytes32 _tariff) external onlySuperuser {
    _migrate(_from, _to, _tariff);
    emit ChangeAddress(_from, _to, _tariff, msg.sender);
  }

  // INTERNAL

  function _migrate(address _from, address _to, bytes32 _tariff) internal {
    require(_to != address(0), "_to can't be 0x0 address");

    (,,,uint256 lastClaimedTimestamp) = dcity.getParticipantTariffInfo(_from, _tariff);
    (,,uint256 payment,uint256 paymentPeriodLength,,,,,CityLibrary.TariffCurrency currency,) = dcity.getTariff(_tariff);

    bool canClaimSome = (now -  paymentPeriodLength) > lastClaimedTimestamp;

    dcity.kickTariffParticipation(_from, _tariff);
    dcity.addParticipation(_to, _tariff);

    if (currency == CityLibrary.TariffCurrency.ERC20) {
      uint256 balance = IERC20(erc20Token).balanceOf(_from);
      require(balance > 0, "Cant migrate 0 balance");

      // If already claimed
      if (canClaimSome == false) {
        require(IERC20(erc20Token).balanceOf(_from) >= payment, "Insufficient funds to migrate on this period");
      }

      // burn
      ICoinToken(erc20Token).burn(_from, balance);

      //mint
      uint256 toMint = balance;
      if (canClaimSome == false) {
        toMint = toMint.sub(payment);
      }

      ICoinToken(erc20Token).mint(_to, balance.sub(payment));
    }
  }
}
