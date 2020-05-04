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

ops-home:
	NETWORK=sokol node ops/opsHome
	-tput bel

ops-foreign:
	NETWORK=kovan node ops/opsForeign
	-tput bel

migrate-yalland:
	./node_modules/.bin/truffle migrate -f 12 --to 999 --network yalland --reset
	-tput bel

migrate-kovan:
	./node_modules/.bin/truffle migrate -f 2001 --to 2999 --network kovan --reset
	-tput bel

migrate-sokol:
	./node_modules/.bin/truffle migrate -f 1001 --to 1999 --network sokol --reset
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
