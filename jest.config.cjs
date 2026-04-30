/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'jsdom',
  transform: {
    '^.+\\.vue$': [
      '@vue/vue3-jest',
      { tsConfig: { allowJs: true, module: 'CommonJS', moduleResolution: 'node' } },
    ],
    '^.+\\.tsx?$': [
      'ts-jest',
      { tsconfig: { allowJs: true, module: 'CommonJS', moduleResolution: 'node' } },
    ],
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'vue', 'json'],
  testMatch: ['<rootDir>/tests/unit/**/*.test.ts'],
}
