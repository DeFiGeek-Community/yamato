
module.exports = {
  "name": 'unit',
  "displayName": 'unittest',
  "moduleFileExtensions": [
    "js", "ts"
  ],
  "testMatch": [
    "**/test/unit/**/*.test.ts"
  ],
  "moduleNameMapper": {
    '^@root/(.*)$': '<rootDir>/$1',
    '^@src/(.*)$': '<rootDir>/src/$1',
    '^@test/(.*)$': '<rootDir>/test/$1',
    '^@typechainTypes/(.*)$': '<rootDir>/typechain/$1',
  },
  "setupFilesAfterEnv": [
    "jest-allure/dist/setup",
    "./jest.setup.js"
  ],
  "preset": "ts-jest",
  "testEnvironment": "node",
  "transform": {
    "node_modules/variables/.+\\.(j|t)sx?$": "ts-jest"
  },
  "transformIgnorePatterns": [
    "node_modules/(?!variables/.*)"
  ]
}