/*
 * Copyright ©️ 2018 Galt•Project Society Construction and Terraforming Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka)
 *
 * Copyright ©️ 2018 Galt•Core Blockchain Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka) by
 * [Basic Agreement](ipfs/QmaCiXUmSrP16Gz8Jdzq6AJESY1EAANmmwha15uR3c1bsS)).
 */

export interface IDCityChainService {
    getDefaultTokenAddress(): string;

    getCityAddress(): string;

    getCurrentBlock(): Promise<number>;

    getBlockTimeStamp(blockNumber): Promise<number>;

    getBlockTransactionCount(blockNumber): Promise<number>;

    onReconnect(callback): void;

    weiToEther(wei): number;

    getTotalSupply(): Promise<any>;

    getTokensBalance(address, tokenAddress?): Promise<any>;

    sendTokens(fromAddress, fromPrivateKey, to, amount): Promise<any>;

    sendTokensList(fromAddress, fromPrivateKey, sendList): Promise<any>;

    isContractManager(address): Promise<boolean>;

    getTokenOwner(): Promise<string>;

    isSignatureValid(address, signature, message, fieldName): boolean;

    getExplorerTokensBalance(address, tokenAddress?): Promise<any>;

    getEthBalance(address): Promise<any>;

    getTokensTransfersSumOfAddress(address, fromBlock?): Promise<number>;

    getAllTokensTransfers(fromBlock?, toBlock?, filters?): Promise<any>;

    runAutoClaimer(): void;

    getActiveCityMembers(): Promise<string[]>;

    getCityTariffsIds(): Promise<string[]>;

    getCityTariffInfo(tariffId): Promise<any>;

    getTariffActiveParticipantsCount(tariffId): Promise<number>;

    getAllParticipants(tariffId): Promise<any[]>;

    getParticipantsForClaim(tariffId): Promise<any[]>;

    addParticipationList(addressList, tariffId): Promise<any[]>;
}

export interface IDCityChainTransferEvent {
    returnValues: { from: string, to: string, value: number };
}