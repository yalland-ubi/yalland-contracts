
const axios = require('axios/index');
const async = require('async');
const assert = require('assert');
const fs = require('fs');
const Web3 = require('web3');
const _ = require('lodash');

axios.interceptors.request.use(request => {
  console.log('Starting Request', request);
  return request;
});

const network = 'sokol';
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


const chainSpec = JSON.parse(fs.readFileSync(`deployed/${network}_extended.json`));

async function sleep(timeout) {
  return new Promise(resolve => {
    setTimeout(resolve, timeout);
  });
}
(async () => {
  // contract key
  const key = process.argv[2];
  const proxy = process.argv[3];

  const contract = chainSpec.contracts[key];
  assert(contract.address.length > 0, `Missing deployment data for '${key}'`)

  console.log('Verifying', key, 'at address', contract.address);

  if (contract.proxied) {
    if (proxy) {
      await verifyPost(
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
      await verifyPost(
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
    await verifyPost(
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

