const { assert } = require('chai');
const { BigNumber } = require('bignumber.js');

function helpers(web3) {
    const { assertErc20BalanceChanged } = require('@galtproject/solidity-test-chest')(web3);
    const keccak256 = web3.utils.soliditySha3;
    const { toBN } = web3.utils;

    function fixSignature(signature) {
        let v = parseInt(signature.slice(130, 132), 16);
        if (v < 27) {v += 27;}const vHex = v.toString(16);
        return signature.slice(0, 130) + vHex;
    }

    const approveFunction = async (
        { from, to, encodedFunctionCall, txFee, gasPrice, gas, nonce, relayerAddress, relayHubAddress }
    ) => {
        // console.log('approve::id::', await web3.eth.net.getId());
        // console.log('approve::accounts::', await web3.eth.getAccounts());
        return fixSignature(
            await web3.eth.sign(
                keccak256(
                    relayerAddress,
                    from,
                    encodedFunctionCall,
                    toBN(txFee),
                    toBN(gasPrice),
                    toBN(gas),
                    toBN(nonce),
                    relayHubAddress,
                    to
                ),
                from
            )
        );
    };

    function assertRelayedCall(response) {
        assert.equal(
            response.receipt.to,
            '0xd216153c06e857cd7f72665e0af1d7d82172f494',
            'The call should be relayed'
        )
    }

    function assertYallWithdrawalChanged(before, after, expected) {
        const hundredPct = new BigNumber(100);
        // the fee is constant across all the tests
        const feePct = new BigNumber('0.02');
        const newExpected = (new BigNumber(expected)).multipliedBy(hundredPct).dividedBy(hundredPct.plus(feePct));
        return assertErc20BalanceChanged(before, after, newExpected.toString());
    }

    const GSNRecipientSignatureErrorCodes = {
        METHOD_NOT_SUPPORTED: 11,
        OK: 12,
        DENIED: 13,
        INSUFFICIENT_BALANCE: 14
    }


    return {
        approveFunction,
        assertRelayedCall,
        assertYallWithdrawalChanged,
        fixSignature,
        GSNRecipientSignatureErrorCodes
    }
}

module.exports = helpers;
