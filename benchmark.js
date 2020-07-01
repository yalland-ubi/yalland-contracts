const Table = require('cli-table');

function benchmark(callback) {
  this.befores = [];
  this.beforeEachs = [];
  this.runs = [];
  this.table = new Table({
    head: ['Description', 'Consumed Gas'],
    colWidths: [100, 15],
  });

  callback.call(this);
  execute.call(this);
}

async function execute() {
  // befores
  const befores = this.befores;
  for (let i = 0; i < befores.length; i++) {
    try {
      // eslint-disable-next-line no-await-in-loop
      await befores[i]();
    } catch (e) {
      console.log('Error:', e);
      process.exit(1);
      return;
    }
  }

  // runs
  const runs = this.runs;
  for (let i = 0; i < runs.length; i++) {
    const run = runs[i];

    if (run.type === 'title') {
      this.table.push([run.name, '']);
      continue;
    }

    // before Eachs
    {
      for (let i = 0; i < this.beforeEachs.length; i++) {
        try {
          await this.beforeEachs[i]()
        } catch (e) {
          console.log('Error:', e);
          process.exit(1);
          return;
        }
      }
    }

    try {
      let res = await run.callback();
      let gas = (typeof res === 'object' && 'receipt' in res) ? (res.receipt.gasUsed - 21000) : res;
      this.table.push([run.name, gas.toLocaleString('en')])
      // console.log(`${run.name}: ${res.receipt.gasUsed} gas`);
    } catch (e) {
      console.log('Benchmark Error:', e);
      process.exit(1);
      return;
    }
  }

  console.log(this.table.toString());
  process.exit(0);
}

function describe(name, callback) {
  this.runs.push({ type: 'title', name });
  callback.call(this);
}

function run(name, callback) {
  this.runs.push({ name, callback });
  return { name, callback };
}

function before(callback) {
  this.befores.push(callback);
}

function beforeEach(callback) {
  this.beforeEachs.push(callback);
}

global.run = run;
global.before = before;
global.beforeEach = beforeEach;
global.describe = describe;

module.exports = benchmark;
