const CoinToken = artifacts.require('./CoinToken');
const City = artifacts.require('./City');
const Web3 = require('web3');

const web3 = new Web3(CoinToken.web3.currentProvider);

const fs = require('fs');

module.exports = async function(deployer, network, accounts) {
  if (network === 'test' || network === 'local_test' || network === 'development') {
    console.log('Skipping deployment migration');
    return;
  }

  deployer.then(async () => {
    const coreTeam = accounts[0];
    // const proxiesAdmin = accounts[1];

    // Deploy contracts...
    console.log('Create contract instances...');
    const coinToken = await CoinToken.new({ from: coreTeam });
    const city = await City.new(10000, "City", "CT", { from: coreTeam });

    console.log('Set roles...');
    await coinToken.addRoleTo(coreTeam, "minter", { from: coreTeam });
    await coinToken.addRoleTo(city.address, "minter", { from: coreTeam });
    await coinToken.addRoleTo(city.address, "burner", { from: coreTeam });
    await coinToken.addRoleTo(coreTeam, "fee_manager", { from: coreTeam });

    console.log('Fill initial data...');
    // Call initialize methods (constructor substitute for proxy-backed contract)
    const coinTariffResponse = await city.createTariff("Pay coins", Web3.utils.toWei('10', 'ether'), (60 * 2).toString(), "1", coinToken.address, { from: coreTeam });
    const coinTariffId = coinTariffResponse.logs[0].args.id;
    await city.createTariff("Pay ether", Web3.utils.toWei('1', 'ether'), (60 * 60 * 5).toString(), "0", '0x0000000000000000000000000000000000000000', { from: coreTeam });
    await city.changeParticipationTariff(coreTeam, coinTariffId, { from: coreTeam });
    await city.mintTokens(coinToken.address, Web3.utils.toWei('10000000', 'ether'), { from: coreTeam });
    await coinToken.setTransferFee(Web3.utils.toWei((0.5).toString(), 'szabo'), {from: coreTeam});

    const sendWei = Web3.utils.toWei('1000', 'ether').toString(10);
    await web3.eth.sendTransaction({ from: coreTeam, to: city.address, value: sendWei }).catch(() => {});

    console.log('Save addresses and abi to deployed folder...');

    await new Promise(resolve => {
      const deployDirectory = `${__dirname}/../deployed`;
      if (!fs.existsSync(deployDirectory)) {
        fs.mkdirSync(deployDirectory);
      }

      const deployFile = `${deployDirectory}/${network}.json`;
      console.log(`saved to ${deployFile}`);

      fs.writeFile(
        deployFile,
        JSON.stringify(
          {
            coinTokenAddress: coinToken.address,
            coinTokenAbi: coinToken.abi,
            cityAddress: city.address,
            cityAbi: city.abi
          },
          null,
          2
        ),
        resolve
      );
    });
  });
};
