<p align="center"> <img src="https://yalland.com/assets/icons/logo.svg" alt="logo-black-360" width="200"/></p>


<h3 align="center">Yalland Contracts (@yalland-contracts)</h3>
<div align="center">
</div>

<div align="center">

![CI](https://github.com/yalland-ubi/yalland-contracts/workflows/CI/badge.svg)
<a href="https://codecov.io/gh/yalland-ubi/yalland-contracts">
  <img src="https://codecov.io/gh/yalland-ubi/yalland-contracts/branch/develop/graph/badge.svg" />
</a>
<img src="https://img.shields.io/github/issues-raw/yalland-ubi/yalland-contracts.svg?color=green&style=flat-square" alt="Opened issues"/>
<img src="https://img.shields.io/github/issues-closed-raw/yalland-ubi/yalland-contracts.svg?color=blue&style=flat-square" alt="Closed issues" />
<img src="https://img.shields.io/github/issues-pr-closed/yalland-ubi/yalland-contracts.svg?color=green&style=flat-square" alt="Closed PR"/>
<img src="https://img.shields.io/github/issues-pr-raw/yalland-ubi/yalland-contracts.svg?color=green&style=flat-square" alt="Opened PR"/>
<img src="https://img.shields.io/badge/version-1.0.0-yellow.svg" alt="Contracts Version"/>
</div>
<br/>
<br/>
<div align="center">
  <img src="https://img.shields.io/github/contributors/yalland-ubi/yalland-contracts?style=flat-square" alt="Сontributors" />
  <img src="https://img.shields.io/badge/contributions-welcome-orange.svg?style=flat-square" alt="Contributions Welcome" />
</div>
<br/>

## Yalland universal basic income
**The program is a public blockchain smart contract system managed by a decentralized community. Everyone can participate in the program, verifying himself/herself as a unique person and receive points (tokens), which can be exchanged for products, services or fiat money on the open market. The program is not state-owned and is built on the principles of P2P - economics. The presented smart contract system is blockchain agnostic and can be executed in any Turing-complete virtual machine. It is assumed that it will work initially on Ethereum + xDai and then will be migrated to Ethereum 2.0.**

[@yalland-contracts](https://github.com/yalland-ubi/yalland-contracts/) repo contains smart contracts that enable Yalland members to claim and exchange tokens of Yalland UBI program. Every Yalland member can take a part in current period tokens distribution, earn referral payouts and exchange tokens to any currency.

:page_with_curl: **For more information read the [Whitepaper](https://github.com/yalland-ubi/yalland-docs/blob/master/Whitepaper.md)**

:construction: **@yalland-contracts stage: Testnet**

At the moment, [@yalland-contracts](https://github.com/yalland-ubi/yalland-contracts/) contracts are deployed in our private Yalland network(RPC: https://api.yalland.com:8645/, Explorer: https://explorer.yalland.com/).

:bomb: **Security review status: Unaudited**

:memo:**Get started contributing with a good first [issue](https://github.com/yalland-ubi/yalland-contracts/issues)**.

# Contracts overview
This repository [@yalland-contracts](https://github.com/yalland-ubi/yalland-contracts/) contains main project contracts:
- **YALLDistributor.sol** - main distribution contract;
- **YALLExchange.sol** - a contract that exchanges tokens for fiat currencies from non-profit organizations of the project;
- **YALLRegistry.sol** - registry of roles and rights contract;
- **YALLVerification.sol** - contract containing addresses of non-profit organizations that verify program members;
- **YALLEmissionRewardPool.sol** - emission distribution contract;
- **YALLCommissionRewardPool.sol** - commission distribution contract;

## For Developers

* Compile contracts

```sh
make compile
```

* Run tests

```sh
npm test
```

* Run Solidity and JavaScript linters

```sh
make lint
```
