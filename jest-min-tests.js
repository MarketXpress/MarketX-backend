/**
 * Jest globalTeardown – enforces a minimum passing-test floor so that a
 * broken test-discovery configuration (bad testRegex, wrong rootDir, missing
 * transform) cannot silently produce a 0-test green run.
 *
 * The threshold is intentionally conservative: it only needs to catch the
 * "zero tests found" scenario described in issue #487, not enforce full
 * coverage targets.  Raise MIN_TESTS if the suite grows substantially.
 */

'use strict';

const MIN_TESTS = 50;

module.exports = async function globalTeardown(_globalConfig) {
  // Jest does not expose the aggregate test count to globalTeardown directly,
  // so we read the JSON results file that jest writes when --json / --outputFile
  // is used.  When those flags are absent we fall back to a results file we
  // write ourselves via the testResultsProcessor below.  If neither is present
  // we skip the floor check to stay non-breaking in watch mode.
  const fs = require('fs');
  const path = require('path');

  const resultsPath = path.join(
    process.cwd(),
    'jest-results-for-floor-check.json',
  );

  if (!fs.existsSync(resultsPath)) {
    // Results file absent (e.g. watch mode) — skip the floor check.
    return;
  }

  let results;
  try {
    results = JSON.parse(fs.readFileSync(resultsPath, 'utf8'));
  } catch {
    // Corrupt file — clean up and skip.
    fs.unlinkSync(resultsPath);
    return;
  }

  // Clean up the temporary file so it does not accumulate between runs.
  fs.unlinkSync(resultsPath);

  const numPassedTests = results.numPassedTests ?? 0;
  const numTotalTests = results.numTotalTests ?? 0;

  if (numTotalTests < MIN_TESTS) {
    // Exit with a non-zero code so CI fails visibly.
    const message =
      `\n[jest-min-tests] FAIL: only ${numTotalTests} tests were collected ` +
      `(${numPassedTests} passed). ` +
      `The minimum allowed is ${MIN_TESTS}.\n` +
      `If test discovery is broken (wrong rootDir, testRegex, or transform) ` +
      `this floor prevents a false-green CI run.\n`;

    process.stderr.write(message);
    process.exitCode = 1;
  }
};
