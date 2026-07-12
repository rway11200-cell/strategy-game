  import js from "@eslint/js";
  import eslintConfigPrettier from "eslint-config-prettier";
  import tseslint from "typescript-eslint";

  export default tseslint.config(
    { ignores: ["dist"] },
    {
      extends: [
        js.configs.recommended,
        ...tseslint.configs.recommended,
        eslintConfigPrettier
      ],
      files: ["**/*.{ts,tsx}"],
      languageOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
      },
      rules: {
        "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      },
    },
  );
