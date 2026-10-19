module.exports = {
  root: true,
  extends: '@react-native',
  overrides: [
    {
      // Jest globals (jest, describe, expect…) in tests and their setup file.
      files: ['jest.setup.js', '**/__tests__/**', '**/*.test.{js,ts,tsx}'],
      env: { jest: true },
    },
  ],
};
