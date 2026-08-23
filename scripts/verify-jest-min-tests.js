#!/usr/bin/env node
'use strict';

/**
 * Manual reproduction / regression check for the jest-min-tests floor.
 * Run with: npm run verify:min-tests-reporter
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const MinTestsReporter = require('../jest-min-tests-reporter');

function run(numTotalTests, globalConfigOverrides = {}) {
  const reporter = new MinTestsReporter({
    watch: false,
    watchAll: false,
    ...globalConfigOverrides,
  });
  const originalExitCode = process.exitCode;
  process.exitCode = 0;
  reporter.onRunComplete(
    {},
    { numTotalTests, numPassedTests: numTotalTests, numFailedTests: 0 },
  );
  const exitCode = process.exitCode;
  process.exitCode = originalExitCode;
  return exitCode;
}

// 1. Fresh checkout, under-floor run: must fail on the FIRST invocation.
assert.strictEqual(
  run(11),
  1,
  'expected floor to fail on a fresh, first invocation',
);

// 2. Same command run again: identical outcome, not dependent on run #1.
assert.strictEqual(
  run(11),
  1,
  'expected floor to fail identically on repeat runs',
);

// 3. A leftover file from the old (removed) implementation must have no effect.
const legacyLeftover = path.join(
  process.cwd(),
  'jest-results-for-floor-check.json',
);
let wroteLegacyFile = false;
try {
  fs.writeFileSync(legacyLeftover, JSON.stringify({ numTotalTests: 500 }));
  wroteLegacyFile = fs.existsSync(legacyLeftover);
  assert.ok(
    wroteLegacyFile,
    `setup failed: could not create ${legacyLeftover} to simulate a legacy leftover file`,
  );

  assert.strictEqual(
    run(11),
    1,
    'a leftover jest-results-for-floor-check.json must not mask a low current count',
  );
} finally {
  // Guard cleanup so a missing/already-removed file can never crash this
  // script — the reporter itself never touches this file, so its presence
  // here is purely an artifact of this test setup.
  if (fs.existsSync(legacyLeftover)) {
    fs.unlinkSync(legacyLeftover);
  }
}

// 4. A run at the floor passes.
assert.strictEqual(
  run(50),
  0,
  'expected floor to pass at exactly the threshold',
);

// 5. Watch mode is never failed by the floor, regardless of count.
assert.strictEqual(
  run(0, { watch: true }),
  0,
  'watch mode must not be failed by the floor',
);

console.log('[verify-jest-min-tests] all checks passed');