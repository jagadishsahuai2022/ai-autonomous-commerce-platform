/**
 * Jest global test setup
 * Applied after the test framework is installed in the environment
 */

// Increase default timeout for integration tests
jest.setTimeout(30000);

// Suppress console.error/warn noise in tests unless TEST_VERBOSE is set
if (!process.env.TEST_VERBOSE) {
  global.console.error = jest.fn();
  global.console.warn = jest.fn();
}

// Global afterEach: restore any spies/mocks
afterEach(() => {
  jest.restoreAllMocks();
});
