
const axios = require('axios/index');
const async = require('async');
const assert = require('assert');
const fs = require('fs');
const Web3 = require('web3');
const _ = require('lodash');
const querystring = require('querystring');

axios.interceptors.request.use(request => {
  console.log('Starting Request', request);
  return request;
});

const network = 'kovan';
const base = 'https://blockscout.com/';

const verifyPost = async (
  name,
  addressHash,
  optimization,
  optimizationRuns,
  evmVersion,
  compilerVersion,
  contractSourceCode,
  constructorArgs,
  libs
) => {
  console.log(name, 'verification');
  assert.ok(name);
  assert.ok(addressHash);
  assert.ok(compilerVersion);

  const params = {
    module: 'contract',
    action: 'verify',
    name,
    address_hash: addressHash,
    compiler_version: compilerVersion,
    contract_source_code: contractSourceCode,
    optimization_runs: optimizationRuns,
    evm_version: evmVersion,
    constructor_arguments: constructorArgs,
    optimization: !!optimization
  };

  if (libs) {
    for (let i = 0; i < libs.length; i++) {
      params[`library${i}_address`] = libs[i][0];
      params[`library${i}_name`] = libs[i][1];
    }
  }

  try {
    console.log(`Verifying ${name} - ${addressHash}`);
    const response = await axios({
      url: `/poa/${network}/api/v1/verified_smart_contracts`,
      method: 'post',
      baseURL: base,
      data: params
    });
    const { data } = response;
    console.log(data);
    console.log('Done for', addressHash);
  } catch (error) {
    console.log(`${name} - ${addressHash} verification error: ${JSON.stringify(error.response.data)}`);
  }
};


const verifyKovanEtherscan = async (
  name,
  addressHash,
  optimization,
  optimizationRuns,
  evmVersion,
  compilerVersion,
  contractSourceCode,
  constructorArgs,
  libs,
  proxy
) => {
  console.log(name, 'verification');
  assert.ok(name);
  assert.ok(addressHash);
  assert.ok(compilerVersion);

  const apiKey = 'GZZTYX65FNXUPIZVABYWY76FDPDHAF3GAA';
  const base = 'https://api-kovan.etherscan.io';

  const params = {
    apikey: apiKey,
    module: 'contract',
    action: 'verifysourcecode',
    contractname: name,
    contractaddress: addressHash,
    compilerversion: compilerVersion,
    sourceCode: contractSourceCode,
    runs: optimizationRuns,
    evmversion: evmVersion,
    constructorArguements: constructorArgs ? `0x${constructorArgs}` : '',
    optimizationUsed: optimization ? 1 : 0
  };

  if (libs) {
    for (let i = 0; i < libs.length; i++) {
      params[`library${i}address`] = libs[i][0];
      params[`library${i}name`] = libs[i][1];
    }
  }

  try {
    console.log(`Verifying ${name} - ${addressHash}`);
    let response = await axios({
      url: '/api',
      method: 'POST',
      baseURL: base,
      data: querystring.stringify(params)
    });
    const { data } = response;
    console.log(data);

    if (data.status == 1) {
      response = await axios({
        url: '/api',
        method: 'GET',
        baseURL: base,
        params: {
          guid: data.result,
          module: 'contract',
          action: 'checkverifystatus'
        }
      });
      console.log(response);
    }
    // TODO: check explanation
  } catch (error) {
    try {
      console.log(`${name} - ${addressHash} verification error: ${JSON.stringify(error.response.data)}`);
    } catch (e) {
      console.log('verification error:', error);
    }
  }
};

const chainSpec = JSON.parse(fs.readFileSync(`deployed/${network}_extended.json`));

async function sleep(timeout) {
  return new Promise(resolve => {
    setTimeout(resolve, timeout);
  });
}
(async () => {
  const verify = network === 'sokol' ? verifyPost : verifyKovanEtherscan;

  // contract key
  const key = process.argv[2];
  const proxy = process.argv[3];

  const contract = chainSpec.contracts[key];
  assert(contract.address.length > 0, `Missing deployment data for '${key}'`)

  console.log('Verifying', key, 'at address', contract.address);

  if (contract.proxied) {
    if (proxy) {
      await verify(
        'AdminUpgradeabilityProxy',
        contract.address,
        chainSpec.compiler.optimizer.enabled,
        chainSpec.compiler.optimizer.runs,
        chainSpec.compiler.evmVersion,
        `v${chainSpec.compiler.version}`,
        fs.readFileSync(`scripts/assets/AdminUpgradeabilityProxy.sol`).toString(),
        contract.proxyArguments.substring(2)
      )
    } else {
      await verify(
        contract.factory,
        contract.implementation,
        chainSpec.compiler.optimizer.enabled,
        chainSpec.compiler.optimizer.runs,
        chainSpec.compiler.evmVersion,
        `v${chainSpec.compiler.version}`,
        fs.readFileSync(`build/flattened/${contract.factory}.sol`).toString(),
        null
      )
    }
  } else {
    await verify(
      contract.factory,
      contract.address,
      chainSpec.compiler.optimizer.enabled,
      chainSpec.compiler.optimizer.runs,
      chainSpec.compiler.evmVersion,
      `v${chainSpec.compiler.version}`,
      fs.readFileSync(`build/flattened/${contract.factory}.sol`).toString(),
      contract.constructorArguments
    )
  }
})();

