module.exports = {
  extends: 'airbnb-base',
  env: {
    mocha: true,
    node: true,
  },
  rules: {
    'arrow-body-style': 'off',
    'arrow-parens': ['error', 'always'],
    'consistent-return': 'off',
    'no-else-return': 'off',
    'no-plusplus': ['error', {
      allowForLoopAfterthoughts: true,
    }],
    'no-shadow': 'off',
    'no-unused-vars': ['error', {
      // Allow variables with leading underscores.
      argsIgnorePattern: '^_',
    }],
    'padded-blocks': 'off',
  },
};
