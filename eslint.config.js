import globals from "globals";
import react from "eslint-plugin-react";
export default [
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "artifacts/mockup-sandbox/**",
      "lib/**",
      "test-results/**",
    ],
  },
  {
    files: [
      "artifacts/api-server/**/*.js",
      "artifacts/signal/**/*.js",
      "artifacts/signal/**/*.jsx",
      "scripts/*.mjs",
      "tests/**/*.js",
      "tests/**/*.mjs",
      "*.js",
    ],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: { ...globals.node, ...globals.browser },
    },
    settings: { react: { version: "19.1" } },
    plugins: { react },
    rules: {
      "no-undef": "error",
      "no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
        },
      ],
      "no-unreachable": "error",
      "no-constant-condition": "error",
      eqeqeq: ["error", "always", { null: "ignore" }],
      "react/jsx-uses-vars": "error",
      "react/jsx-key": "error",
      "react/no-danger": "error",
      "react/no-direct-mutation-state": "error",
    },
  },
];
