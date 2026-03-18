import { BaseObserver } from '@journeyapps-labs/common-utils';
import { ValidationResult, ValidationTestRunResult } from '@powersync/cli-core';
import ora from 'ora';

import { formatOraMessage, formatValidationHuman, STABLE_OUTPUT_NAMES } from './validation-utils.js';
import { ValidationTest, ValidationTestDefinition } from './ValidationTestDefinition.js';

export interface ValidationsRunnerListener {
  testCompleted: (testName: ValidationTest) => void;
}

export type ValidationsRunnerOptions = {
  /**
   * Tests that are pre-marked as passed (with a "skipped" warning) without being executed.
   * Useful for tests that were intentionally omitted from this run but should still appear in the output.
   */
  skippedTests?: ValidationTest[];
  tests: ValidationTestDefinition[];
};

/**
 * Runs a set of named validation tests sequentially and collects their results.
 * Supports skipped tests (pre-marked as passed) and optional progress spinner output via {@link runWithProgress}.
 */
export class ValidationsRunner extends BaseObserver<ValidationsRunnerListener> {
  readonly testResults: Map<ValidationTest, ValidationTestRunResult>;
  private skippedTests: ValidationTest[];
  private testNames: ValidationTest[];
  private tests: ValidationTestDefinition[];

  constructor(protected options: ValidationsRunnerOptions) {
    super();
    this.tests = options.tests;
    this.skippedTests = options.skippedTests ?? [];
    this.testNames = [...this.skippedTests, ...this.tests.map((t) => t.name)];
    this.testResults = new Map();
    for (const test of this.skippedTests)
      this.testResults.set(test, { passed: true, warnings: ['Test skipped based on input flags.'] });
  }

  /** Runs all tests sequentially and returns the aggregated result. Use {@link runWithProgress} to also show a spinner. */
  async run(): Promise<ValidationResult> {
    if (this.skippedTests.length > 0) {
      this.iterateListeners((listener) => {
        for (const test of this.skippedTests) listener.testCompleted?.(test);
      });
    }

    for (const testDef of this.tests) {
      try {
        const testResult = await testDef.run();
        this.testResults.set(testDef.name, testResult);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.testResults.set(testDef.name, { errors: [message], passed: false });
      } finally {
        this.iterateListeners((listener) => listener.testCompleted?.(testDef.name));
      }
    }

    const allResults = [...this.testResults.entries()].map(([name, result]) => ({
      id: name,
      name: STABLE_OUTPUT_NAMES[name] ?? name,
      ...result
    }));
    const passed = allResults.every((result) => result.passed);

    return { passed, tests: allResults };
  }

  /**
   * Runs tests while showing a progress spinner, and updates the spinner text as each test completes.
   * The spinner is stopped once all tests have completed.
   */
  async runWithProgress(params: { printSummary?: (summary: string) => void } = {}): Promise<ValidationResult> {
    const { printSummary } = params;
    const spinner = ora({
      discardStdin: false,
      text: formatOraMessage(this.testNames, this.testResults)
    }).start();
    const dispose = this.registerListener({
      testCompleted: () => {
        spinner.text = formatOraMessage(this.testNames, this.testResults);
      }
    });

    let result: ValidationResult;
    try {
      result = await this.run();
    } finally {
      dispose();
      spinner.stop();
    }

    if (printSummary && result) {
      printSummary(formatValidationHuman(result));
    }

    return result;
  }
}
