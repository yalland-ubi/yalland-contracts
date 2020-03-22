function helpers(web3) {
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

    return {
        approveFunction,
        fixSignature,
    }
}

module.exports = helpers;
