'use strict';

/**
 * Custom Jest reporter that enforces a minimum passing-test floor.
 *
 * Why a reporter instead of globalTeardown + a temp file:
 * globalTeardown has no access to the aggregated test results, so the
 * previous implementation persisted a JSON summary to disk in
 * testResultsProcessor and re-read it in globalTeardown. Jest runs
 * globalTeardown *before* testResultsProcessor, so that file was always
 * either missing (fresh checkout) or one run stale — the floor never
 * checked the current run's count.
 *
 * A reporter's onRunComplete hook receives the current run's aggregated
 * results directly and can set process.exitCode, so no file and no
 * ordering dependency is needed.
 *
 * MIN_TESTS: kept at 50 (unchanged from #487). This only needs to catch a
 * broken test-discovery config (wrong rootDir/testRegex/transform)
 * producing a false-green run with far fewer tests than expected — it is
 * not a coverage threshold. --passWithNoTests has already been removed
 * from `npm test`, so this floor's remaining job is catching a *partial*
 * collapse (e.g. 200 tests down to 12), not a literal zero-test run.
 * Raise it if the suite's baseline count grows well past this floor.
 */

const MIN_TESTS = 50;

class MinTestsReporter {
  constructor(globalConfig) {
    this._globalConfig = globalConfig;
  }

  onRunComplete(_contexts, results) {
    // Watch mode runs are interactive/incremental (e.g. a single file via
    // testPathPattern); a low count there is expected and must not fail
    // the process.
    if (this._globalConfig.watch || this._globalConfig.watchAll) {
      return;
    }

    const numTotalTests = results.numTotalTests ?? 0;
    const numPassedTests = results.numPassedTests ?? 0;

    if (numTotalTests < MIN_TESTS) {
      process.stderr.write(
        `\n[jest-min-tests] FAIL: only ${numTotalTests} tests were collected ` +
          `(${numPassedTests} passed). The minimum allowed is ${MIN_TESTS}.\n` +
          `If test discovery is broken (wrong rootDir, testRegex, or transform) ` +
          `this floor prevents a false-green CI run.\n`,
      );
      process.exitCode = 1;
    }
  }
}

module.exports = MinTestsReporter;