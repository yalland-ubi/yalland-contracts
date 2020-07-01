.PHONY: test coverage ops

cleanup:
	rm -rf ./build

compile: cleanup
	npm run compile
	node scripts/logContractSizes.js
	-tput bel

lint:
	npm run lint:sol
	npm run lint:js

test:
	-npm test
	-tput bel

flatten:
	node scripts/extracter.js
	node scripts/flattenDeployed.js

benchmark:
	node benchmarks/main.js
	-tput bel

ops-home:
	NETWORK=sokol node ops/opsHome
	-tput bel

ops-foreign:
	NETWORK=kovan node ops/opsForeign
	-tput bel

deploy-yalland:
	RESULT_FILE=yalland_netconfig ./node_modules/.bin/truffle migrate -f 14 --to 999 --network yalland
	-tput bel

deploy-kovan:
	./node_modules/.bin/truffle migrate -f 2001 --to 2999 --network kovan --reset
	-tput bel

deploy-sokol:
	./node_modules/.bin/truffle migrate -f 1001 --to 1999 --network sokol --reset
	-tput bel

deploy-ganache:
	./node_modules/.bin/truffle migrate -f 1001 --to 1999 --network ganache --reset
	-tput bel

deploy:
	DEPLOYMENT_KEY= npm run migrate
	-tput bel

coverage:
	-npm run coverage
	-tput bel

ganache:
	bash ./scripts/runGanache.sh

check-size:
	node scripts/checkContractSize.js

fork:
	yarn run ganache-fork


ctest: compile test
