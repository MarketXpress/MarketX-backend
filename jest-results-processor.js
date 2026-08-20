/**
 * Jest testResultsProcessor – writes a slim JSON summary that
 * jest-min-tests.js (globalTeardown) can read to enforce a minimum test count.
 *
 * Jest passes the full AggregatedResult object here; we only persist the
 * fields the floor-check cares about to keep the file small.
 */

'use strict';

const fs = require('fs');
const path = require('path');

module.exports = function minTestsResultsProcessor(results) {
  const summary = {
    numTotalTests: results.numTotalTests,
    numPassedTests: results.numPassedTests,
    numFailedTests: results.numFailedTests,
    numPendingTests: results.numPendingTests,
  };

  fs.writeFileSync(
    path.join(process.cwd(), 'jest-results-for-floor-check.json'),
    JSON.stringify(summary),
  );

  // testResultsProcessor must return the results object unchanged.
  return results;
};
