/**
 * Jest configuration
 *
 * Two projects:
 *  - unit:    unit tests under ./tests/         (existing tests)
 *  - e2e:     E2E tests under ./miniprogram/tests/  (new, requires DevTools automation port)
 *
 * Run only one suite via:
 *   npx jest --selectProjects unit
 *   npx jest --selectProjects e2e
 */
module.exports = {
  projects: [
    {
      displayName: 'unit',
      preset: 'ts-jest',
      testEnvironment: 'node',
      rootDir: __dirname,
      roots: ['<rootDir>/tests', '<rootDir>/miniprogram/tests'],
      // 单元测试用 .test.ts；E2E spec 用 .spec.ts（在 e2e project 中）
      testMatch: ['<rootDir>/tests/**/*.test.ts', '<rootDir>/miniprogram/tests/**/*.test.ts'],
      testPathIgnorePatterns: [
        '/node_modules/',
        '/reports/'
      ],
      moduleFileExtensions: ['ts', 'js', 'json'],
      collectCoverageFrom: [
        'typings/**/*.ts',
        'miniprogram/**/*.ts'
      ],
      coverageDirectory: 'coverage',
      verbose: true
    },
    {
      displayName: 'e2e',
      preset: 'ts-jest',
      testEnvironment: 'node',
      rootDir: __dirname,
      roots: ['<rootDir>/miniprogram/tests'],
      // e2e 测试统一使用 .spec.ts 命名，与单元测试 (.test.ts) 物理隔离
      testMatch: ['**/*.spec.ts'],
      testPathIgnorePatterns: [
        '/node_modules/',
        '/reports/',
        '/.ai-cache/'
      ],
      moduleFileExtensions: ['ts', 'js', 'json'],
      // E2E tests need a longer timeout: WeChat DevTools launch + page nav can be slow
      testTimeout: 120000,
      // globalSetup / globalTeardown：建立并关闭 miniprogram-automator 共享连接
      // 见 architect §3.1.1
      globalSetup: '<rootDir>/miniprogram/tests/e2e/global-setup.ts',
      globalTeardown: '<rootDir>/miniprogram/tests/e2e/global-teardown.ts',
      // Don't try to instrument the miniprogram runtime files; only the e2e helper code
      collectCoverageFrom: [
        'miniprogram/tests/e2e/**/*.ts',
        'miniprogram/tests/specs/**/*.ts'
      ],
      coverageDirectory: 'coverage/e2e',
      verbose: true
    }
  ]
};
