const assert = require('assert');
const fs = require('fs');

module.exports = function (web3, proxyContract) {
  // eslint-disable-next-line

  function Deployment(truffle, network, deployerAccount) {
    this.truffle = truffle;
    this.network = network;
    this.deployerAccount = deployerAccount;
    this.data = {};
    this.dataExtended = { contracts: {} };
  }

  Deployment.existing = async function (truffle, network, deployerAccount) {
    const deployment = new Deployment(truffle, network, deployerAccount);

    deployment.data = JSON.parse(fs.readFileSync(`../deployed/${this.networkId}.json`));
    deployment.dataExtended = JSON.parse(fs.readFileSync(`../deployed/${this.networkId}_extended.json`));
  };

  Deployment.prototype.factory = function (factory) {
    return new Contract(
      factory,
      this.truffle,
      this.deployerAccount,
      (contractName, value) => {
        this.data[`${contractName}Address`] = value.address;
        this.data[`${contractName}Abi`] = value.abi;
        this.dataExtended.contracts[contractName] = value;
      },
      (contractName) => {
        return this.dataExtended.contracts[contractName];
      },
      // logProxyData
      (contractName, proxy, proxyArguments) => {
        this.dataExtended.contracts[contractName].proxied = true;
        this.dataExtended.contracts[contractName].implementation = this.dataExtended.contracts[contractName].address;
        this.dataExtended.contracts[contractName].address = proxy.address;
        this.dataExtended.contracts[contractName].proxyArguments = proxyArguments;
        this.data[`${contractName}Address`] = proxy.address;
      }
    );
  };

  Deployment.prototype.existing = function (contractInstance) {
    return new ExistingContract(contractInstance, (contractName, value) => {
      this.data[`${contractName}Address`] = value.address;
      this.data[`${contractName}Abi`] = value.abi;
      this.dataExtended.contracts[contractName] = value;
    });
  };

  Deployment.prototype.onlyAbi = function (factory, contractName) {
    // eslint-disable-next-line
    this.data[`${contractName}Abi`] = factory._json.abi;
  };

  Deployment.prototype.save = async function () {
    try {
      const keys = Object.keys(this.dataExtended.contracts);
      if (keys.length > 0) {
        const key = this.dataExtended.contracts[keys[0]].factory;
        const artifact = JSON.parse(fs.readFileSync(`./build/contracts/${key}.json`).toString());
        const metadata = JSON.parse(artifact.metadata);
        this.dataExtended.compiler = {
          optimizer: metadata.settings.optimizer,
          evmVersion: metadata.settings.evmVersion,
          version: metadata.compiler.version,
        };
      }

      fs.writeFileSync(`./deployed/${this.network}.json`, JSON.stringify(this.data, null, 2), { flag: 'w' });
      fs.writeFileSync(`./deployed/${this.network}_extended.json`, JSON.stringify(this.dataExtended, null, 2), {
        flag: 'w',
      });
    } catch (e) {
      console.log('Deployment: error saving network artifacts', e);
    }
  };

  /**
   * Get an address by a contract key. Returns proxy address if the contract is proxied,
   * contract address itself otherwise.
   * @param contractName
   * @returns { string }
   */
  Deployment.prototype.addr = function (contractName) {
    if (!(contractName in this.dataExtended.contracts)) {
      throw new Error(
        `Missing extended data for contract '${contractName}'. Available keys: ${JSON.stringify(
          Object.keys(this.dataExtended.contracts),
          null,
          2
        )}.\n`
      );
    }
    let addr;
    if (this.dataExtended.contracts[contractName].proxied === true) {
      addr = this.dataExtended.contracts[contractName].proxy;
    } else {
      addr = this.dataExtended.contracts[contractName].address;
    }

    if (addr.length === 0) {
      throw new Error(`Missing address for '${contractName}'`);
    }

    assert.ok(typeof addr === 'string');

    return addr;
  };

  function ExistingContract(contractInstance, logDeploymentData) {
    this.contractInstance = contractInstance;
    this.logDeploymentData = logDeploymentData;
  }

  ExistingContract.prototype.name = function (name) {
    this.name = name;
    return this;
  };

  ExistingContract.prototype.factory = function (factory) {
    this.factory = factory;
    return this;
  };

  ExistingContract.prototype.save = function () {
    const logData = {
      address: this.contractInstance.address,
      abi: this.contractInstance.abi,
      // eslint-disable-next-line
      factory: this.factory._json.contractName
    };

    this.logDeploymentData(this.name, logData);
  };

  function Contract(factory, truffle, deployerAccount, logDeploymentData, getDeploymentData, logProxyData) {
    this.truffle = truffle;
    this.deployerAccount = deployerAccount;
    this.factory = factory;
    this.logDeploymentData = logDeploymentData;
    this.getDeploymentData = getDeploymentData;
    this.logProxyData = logProxyData;
    this.linkages = [];
    this.args = [];
  }

  Contract.prototype.name = function (name) {
    this.name = name;
    return this;
  };

  Contract.prototype.arguments = function (...args) {
    this.args = args;
    return this;
  };

  Contract.prototype.link = function (contractName) {
    const contract = this.getDeploymentData(contractName);
    if (!contract) {
      throw new Error(`No such contract in the dataExtended registry: ${contractName}`);
    }
    assert.ok(contract.factory);
    assert.ok(contract.address);
    this.linkages.push(contract);
    return this;
  };

  Contract.prototype.deploy = async function (withProxy = false) {
    assert.ok(this.name);
    assert.ok(this.factory);
    if (Array.isArray(this.args) === false) {
      this.args = [];
    }

    const logData = {
      // eslint-disable-next-line
      factory: this.factory._json.contractName,
      // eslint-disable-next-line
      abi: this.factory._json.abi
    };

    for (let i = 0; i < this.linkages.length; i++) {
      // console.log('linkages', this.linkages[i]);
      this.factory.link(this.linkages[i].factory, this.linkages[i].address);
      logData.linkages = logData.linkages || [];
      logData.linkages.push([this.linkages[i].factory, this.linkages[i].address]);
    }

    if (typeof this.factory !== 'function') {
      throw new Error(`Factory is not a function:${this.factory}`);
    }

    let contract;
    if (withProxy) {
      contract = await this.truffle.deploy(this.factory);
    } else {
      contract = await this.truffle.deploy(this.factory, ...this.args);
      const abi = contract.contract
        .deploy({
          data: contract.constructor.deployedBytecode,
          arguments: this.args,
        })
        .encodeABI();
      logData.constructorArguments = abi.substring(contract.constructor.deployedBytecode.length);
    }

    logData.address = contract.address;

    this.logDeploymentData(this.name, logData);

    return contract;
  };

  Contract.prototype.deployWithProxy = async function (proxyAdmin) {
    assert(proxyAdmin, 'Missing proxyAdmin');

    // deploy implementation
    const v1 = await this.deploy(true);

    if (typeof v1.contract.methods.initialize !== 'function') {
      if (this.args.length !== 0) {
        throw new Error(
          `Missing #initialize() function for ${this.name}, remove arguments or implement an initializer`
        );
      }
      throw new Error('Contracts without #initialize method dont supported');
    }

    const proxyArgumetns = [v1.address, proxyAdmin, v1.contract.methods.initialize(...this.args).encodeABI()];

    const proxy = await proxyContract.new(...proxyArgumetns);

    this.logProxyData(
      this.name,
      proxy,
      web3.eth.abi.encodeParameters(['address', 'address', 'bytes'], proxyArgumetns).substring(2)
    );

    return this.factory.at(proxy.address);
  };

  return {
    Deployment,
    Contract,
  };
};
