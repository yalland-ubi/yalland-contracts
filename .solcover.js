const { accountsConfig } = require('@openzeppelin/test-environment/lib/accounts');
console.log("Solcover accounts config", accountsConfig[0]);
module.exports = {
  testrpcOptions: "-p 8555 -e 500000000 -a 35",
  skipFiles: ['Migrations.sol', 'mocks'],
  providerOptions: {
    gasPrice: 1,
    accounts: accountsConfig,
  },
  compileCommand: 'npm run compile',
  testCommand: "npm run ttest",
  mocha: {
    timeout: 10000
  }
};
