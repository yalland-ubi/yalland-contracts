.PHONY: test coverage

cleanup:
	rm -rf ./build

compile: cleanup
	npm run compile
	node scripts/logContractSizes.js
	-tput bel

lint:
	npm run ethlint
	npm run eslint

test:
	-npm test
	-tput bel

claim-funds:
	DEPLOYMENT_KEY= NETWORK=sokol node ops/claimFunds
	-tput bel

migrate-sokol:
	DEPLOYMENT_KEY= NETWORK=sokol ./node_modules/.bin/truffle migrate -f 1001 --network sokol --reset
	-tput bel

migrate-ganache:
	./node_modules/.bin/truffle migrate -f 1001 --network ganache --reset
	-tput bel

migrate:
	DEPLOYMENT_KEY= npm run migrate
	-tput bel

deploy:
	-npm run deploy
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
