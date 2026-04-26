module.exports = {
    root: true,
    env: {
        es6: true,
        node: true,
    },
    parser: '@typescript-eslint/parser',
    plugins: ['react', 'react-native', '@typescript-eslint'],
    extends: [
        'eslint:recommended',
        'plugin:react/recommended',
        'plugin:react-native/all',
        'plugin:@typescript-eslint/recommended',
        'prettier',
    ],
    rules: {
        'react/react-in-jsx-scope': 'off',
        'no-unused-vars': 'warn',
        '@typescript-eslint/no-unused-vars': ['warn'],
    },
};