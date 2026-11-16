import js from "@eslint/js";
import jsdoc from "eslint-plugin-jsdoc";

export default [
  js.configs.recommended,
  {
    ignores: [
      "dist/**",
      "coverage/**",
      "test-results/**",
      "playwright-report/**",
      "android/**",
      "data/**",
      "sample/**",
      "workline/**",
    ],
  },
  {
    files: ["src/**/*.js", "scripts/**/*.js"],
    plugins: { jsdoc },
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: {
        document: "readonly",
        window: "readonly",
        localStorage: "readonly",
        console: "readonly",
        process: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
        fetch: "readonly",
        Response: "readonly",
        Request: "readonly",
        Headers: "readonly",
        SpreadsheetApp: "readonly",
        Session: "readonly",
        Utilities: "readonly",
        HtmlService: "readonly",
        google: "readonly",
        URL: "readonly",
      },
    },
    rules: {
      "jsdoc/require-jsdoc": [
        "error",
        {
          publicOnly: false,
          require: {
            FunctionDeclaration: true,
            MethodDefinition: false,
            ClassDeclaration: false,
            ArrowFunctionExpression: false,
            FunctionExpression: false,
          },
          contexts: ["ExportNamedDeclaration > FunctionDeclaration"],
        },
      ],
      "jsdoc/require-description": "error",
      "jsdoc/require-param": "error",
      "jsdoc/require-param-description": "error",
      "jsdoc/require-returns": "error",
      "jsdoc/require-returns-description": "error",
      "jsdoc/check-param-names": "error",
      "jsdoc/check-types": "error",
      "jsdoc/valid-types": "error",
    },
  },
  {
    files: ["test/**/*.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: { URL: "readonly" },
    },
  },
];
