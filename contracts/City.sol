/*
 * Copyright ©️ 2018 Galt•Space Society Construction and Terraforming Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka),
 * [Dima Starodubcev](https://github.com/xhipster),
 * [Valery Litvin](https://github.com/litvintech) by
 * [Basic Agreement](http://cyb.ai/QmSAWEG5u5aSsUyMNYuX2A2Eaz4kEuoYWUkVBRdmu9qmct:ipfs)).
 *
 * Copyright ©️ 2018 Galt•Core Blockchain Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka) and
 * Galt•Space Society Construction and Terraforming Company by
 * [Basic Agreement](http://cyb.ai/QmaCiXUmSrP16Gz8Jdzq6AJESY1EAANmmwha15uR3c1bsS:ipfs)).
 */

pragma solidity 0.4.24;
pragma experimental "v0.5.0";

import "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";
import "openzeppelin-solidity/contracts/ownership/rbac/RBAC.sol";
import "./utils/ArraySet.sol";

library CityLibrary {
    struct Payment {
        bytes32 tariff;
        uint256 lastTimestamp;
        uint256 totalAmount;
    }
    struct ParticipationRequest {
        bytes32 tariff;
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
        TariffCurrency currency;
        address currencyAddress;
        ArraySet.AddressSet activeParticipants;
    }
    enum TariffCurrency {
        ETH,
        ERC20
    }
}

contract City is RBAC {
//    using CityLibrary for CityLibrary.payment;
//    using CityLibrary for CityLibrary.participationRequest;
    
    using ArraySet for ArraySet.AddressSet;
    using ArraySet for ArraySet.Bytes32Set;

    string public constant CITY_MANAGER = "city_manager";
    
    string public name;
    string public symbol;
    uint256 public maxSupply;
    uint256 public confirmsToParticipation;

    event TariffCreated(bytes32 id, string title, uint256 payment, uint256 paymentPeriod, uint8 currency, address currencyAddress);
    event TariffEdited(bytes32 id, string title, uint256 payment, uint256 paymentPeriod, uint8 currency, address currencyAddress);
    event TariffActiveChanged(bytes32 id, bool active);
    event ParticipationRequest(address requested);
    event ParticipationConfirm(address requested, address confirmed, bool fully);
    event ParticipationAdded(address cityManager, address member, bytes32 tariff);
    event ParticipationTariffChanged(address cityManager, address member, bytes32 tariff);

    mapping (address => bool) public participants;
    ArraySet.AddressSet activeParticipants;

    mapping (address => CityLibrary.Payment) private payments;
    mapping (address => CityLibrary.ParticipationRequest) private participationRequests;
    ArraySet.AddressSet activeRequests;

    mapping (bytes32 => CityLibrary.Tariff) private tariffs;
    ArraySet.Bytes32Set activeTariffs;

    constructor(uint256 _maxSupply, string _name, string _symbol) public {
        maxSupply = _maxSupply;
        name = _name;
        symbol = _symbol;

        confirmsToParticipation = 1;

        super.addRole(msg.sender, CITY_MANAGER);
        participants[msg.sender] = true;
        activeParticipants.add(msg.sender);
    }

    function() external payable { }

    modifier onlyCityManager() {
        require(hasRole(msg.sender, CITY_MANAGER), "Only city manager");
        _;
    }
    
    function createTariff(string _title, uint256 _payment, uint256 _paymentPeriod, CityLibrary.TariffCurrency _currency, address _currencyAddress) public onlyCityManager returns(bytes32) {
        bytes32 _id = keccak256(
            abi.encodePacked(
                msg.sender,
                block.timestamp,
                _payment,
                _paymentPeriod,
                _currencyAddress
            )
        );
        require(!tariffs[_id].active, "Tariff already created");
        
        tariffs[_id].title = _title;
        tariffs[_id].payment = _payment;
        tariffs[_id].paymentPeriod = _paymentPeriod;
        tariffs[_id].currency = _currency;
        tariffs[_id].currencyAddress = _currencyAddress;
        tariffs[_id].active = true;

        activeTariffs.add(_id);
        
        emit TariffCreated(_id, _title, _payment, _paymentPeriod, uint8(_currency), _currencyAddress);
        return _id;
    }
    
    function setTariffActive(bytes32 _id, bool _active) public onlyCityManager {
        require(tariffs[_id].active != _active, "Same status");
        
        tariffs[_id].active = _active;
        
        if(_active) {
            activeTariffs.add(_id);
        } else {
            activeTariffs.remove(_id);
        }
        
        emit TariffActiveChanged(_id, _active);
    }
    
    function editTariff(bytes32 _id, string _title, uint256 _payment, uint256 _paymentPeriod, CityLibrary.TariffCurrency _currency, address _currencyAddress) public onlyCityManager {
        tariffs[_id].title = _title;
        tariffs[_id].payment = _payment;
        tariffs[_id].paymentPeriod = _paymentPeriod;
        tariffs[_id].currency = _currency;
        tariffs[_id].currencyAddress = _currencyAddress;
        
        emit TariffEdited(_id, _title, _payment, _paymentPeriod, uint8(_currency), _currencyAddress);
    }

    function setMaxSupply(uint256 _maxSupply) public onlyCityManager {
        maxSupply = _maxSupply;
    }

    function setConfirmsToParticipation(uint256 _confirmsToParticipation) public onlyCityManager {
        confirmsToParticipation = _confirmsToParticipation;
    }

    function claimPayment(address claimFor) public returns (uint256 nextDate) {
        CityLibrary.Payment storage payment = payments[claimFor];
        CityLibrary.Tariff storage tariff = tariffs[payment.tariff];
        require(tariff.active, "Tariff not active");
        require(tariff.payment != 0, "Tariff payment is null");
        require(tariff.paymentPeriod != 0, "Tariff payment period is null");

        require(participants[claimFor], "Not active");
        require(now - tariff.paymentPeriod >= payments[claimFor].lastTimestamp, "Too soon");

        payments[claimFor].lastTimestamp += tariff.paymentPeriod;
        payments[claimFor].totalAmount += tariff.payment;

        if(tariff.currency == CityLibrary.TariffCurrency.ETH) {
            claimFor.transfer(tariff.payment);
        } else {
            ERC20(tariff.currencyAddress).transferFrom(address(this), claimFor, tariff.payment);
        }

        tariff.paymentSent += tariff.payment;

        return payments[claimFor].lastTimestamp + tariff.paymentPeriod;
    }

    function isParticipant(address _address) public view returns (bool) {
        return participants[_address];
    }
    
    function addParticipation(address _address, bytes32 _tariff) public onlyCityManager {
        require(!participants[_address], "Already participant");

        addParticipationUnsafe(_address, _tariff);

        emit ParticipationAdded(msg.sender, _address, _tariff);
    }
    
    function addParticipationUnsafe(address _address, bytes32 _tariff) private {
        participants[_address] = true;
        activeParticipants.add(_address);
        payments[_address].tariff = _tariff;
    }
    
    function changeParticipationTariff(address _address, bytes32 _tariff) public onlyCityManager {
        payments[_address].tariff = _tariff;
        
        emit ParticipationTariffChanged(msg.sender, _address, _tariff);
    }

    function requestParticipation(bytes32 _tariff) public {
        require(activeParticipants.size() < maxSupply, "Not enough supply");
        require(!participants[msg.sender], "Already participant");
        require(!participationRequests[msg.sender].sent, "Already sent");

        participationRequests[msg.sender] = CityLibrary.ParticipationRequest({ sent: true, confirmed: false, confirmationsCount: 0, tariff: _tariff });
        activeRequests.add(msg.sender);
        
        emit ParticipationRequest(msg.sender);
    }

    function confirmParticipation(address _requested) public onlyCityManager returns (uint256 count) {
        require(activeParticipants.size() < maxSupply, "Not enough supply");
        require(!participants[_requested], "Already participant");
        require(participationRequests[_requested].sent, "Not sent");
        require(!participationRequests[_requested].confirmed, "Already confirmed");

        require(participationRequests[_requested].confirmations[msg.sender] == false, "You cant confirm twice");

        participationRequests[_requested].confirmations[msg.sender] = true;
        participationRequests[_requested].confirmationsCount += 1;

        if(participationRequests[_requested].confirmationsCount >= confirmsToParticipation){
            participationRequests[_requested].confirmed = true;
            activeRequests.remove(_requested);
            addParticipationUnsafe(_requested, participationRequests[_requested].tariff);
            emit ParticipationConfirm(_requested, msg.sender, true);
        } else {
            emit ParticipationConfirm(_requested, msg.sender, false);
        }

        return participationRequests[_requested].confirmationsCount;
    }

    function confirmsOf(address _requested) public view returns (uint256) {
        return participationRequests[_requested].confirmationsCount;
    }

    function kickParticipation(address _participant) public onlyCityManager {
        require(participants[_participant], "Not participant");

        participants[_participant] = false;
        activeParticipants.remove(_participant);
    }

    function leaveParticipation() public {
        require(participants[msg.sender], "Not participant");

        participants[msg.sender] = false;
        activeParticipants.remove(msg.sender);
    }

    function addRoleTo(address _operator, string _role) public onlyCityManager {
        super.addRole(_operator, _role);
    }

    function removeRoleFrom(address _operator, string _role) public onlyCityManager {
        super.removeRole(_operator, _role);
    }
}
