// ----- FreeShow -----
// ESLint flat config (ESLint 9). Replaces the legacy eslintrc files
// (eslint.electron.json / eslint.frontend.json / eslint.svelte.js).
//
// Behaviour is kept close to the previous setup: @typescript-eslint recommended
// (+ type-checked) with most of the noisy type-aware rules turned off, the same
// custom rule set, and Prettier last to disable formatting rules. Svelte files are
// parsed with svelte-eslint-parser and linted with the same rules as the frontend
// (no extra svelte-specific rules, matching the old svelte3-processor behaviour).

import prettier from "eslint-config-prettier"
import jsdoc from "eslint-plugin-jsdoc"
import svelteParser from "svelte-eslint-parser"
import tseslint from "typescript-eslint"
import globals from "globals"

// the wrapper types the old `ban-types` map was replaced by `no-restricted-types` in v8
const restrictedTypes = {
    Object: { message: "Avoid using the `Object` type. Did you mean `object`?" },
    Function: { message: "Avoid using the `Function` type. Prefer a specific function type, like `() => void`." },
    Boolean: { message: "Avoid using the `Boolean` type. Did you mean `boolean`?" },
    Number: { message: "Avoid using the `Number` type. Did you mean `number`?" },
    String: { message: "Avoid using the `String` type. Did you mean `string`?" },
    Symbol: { message: "Avoid using the `Symbol` type. Did you mean `symbol`?" }
}

// rules shared by electron + frontend + svelte (translated from the old eslintrc configs)
const sharedRules = {
    "@typescript-eslint/adjacent-overload-signatures": "error",
    "@typescript-eslint/array-type": ["error", { default: "array" }],
    "@typescript-eslint/no-restricted-types": ["error", { types: restrictedTypes }],
    "@typescript-eslint/consistent-type-assertions": "error",
    "@typescript-eslint/consistent-type-imports": ["error", { prefer: "type-imports", disallowTypeAnnotations: true }],
    "@typescript-eslint/dot-notation": "error",
    "@typescript-eslint/no-empty-function": "error",
    "@typescript-eslint/no-empty-object-type": "error", // was no-empty-interface
    "@typescript-eslint/no-explicit-any": "off",
    "@typescript-eslint/no-misused-new": "error",
    "@typescript-eslint/no-namespace": "error",
    "@typescript-eslint/no-unused-expressions": "error",
    "@typescript-eslint/no-use-before-define": "off",
    "@typescript-eslint/prefer-for-of": "error",
    "@typescript-eslint/prefer-function-type": "error",
    "@typescript-eslint/prefer-namespace-keyword": "error",
    "@typescript-eslint/unified-signatures": "error",
    "@typescript-eslint/no-non-null-assertion": "off",
    "@typescript-eslint/naming-convention": "off",
    "@typescript-eslint/no-floating-promises": "off",
    "@typescript-eslint/no-misused-promises": "off",
    // v8 newly-recommended promise/type rules — kept off to match the old config's intent (it already disabled promise enforcement)
    "@typescript-eslint/require-await": "off",
    "@typescript-eslint/await-thenable": "off",
    "@typescript-eslint/prefer-promise-reject-errors": "off",
    "@typescript-eslint/no-unnecessary-type-assertion": "off",
    "@typescript-eslint/restrict-template-expressions": "off",
    "@typescript-eslint/restrict-plus-operands": "off",
    "@typescript-eslint/no-unsafe-member-access": "off",
    "@typescript-eslint/no-unsafe-assignment": "off",
    "@typescript-eslint/no-unsafe-argument": "off",
    "@typescript-eslint/no-unsafe-return": "off",
    "@typescript-eslint/no-unsafe-call": "off",
    "@typescript-eslint/no-unsafe-declaration-merging": "off",
    "@typescript-eslint/no-unsafe-enum-comparison": "off",
    "@typescript-eslint/ban-ts-comment": "off",
    "@typescript-eslint/no-redundant-type-constituents": "off",
    "@typescript-eslint/no-base-to-string": "off",
    "@typescript-eslint/no-duplicate-type-constituents": "off",
    // core rules
    "constructor-super": "error",
    eqeqeq: ["error", "smart"],
    "guard-for-in": "error",
    "id-match": "error",
    "jsdoc/check-alignment": "error",
    "jsdoc/check-indentation": "error",
    "max-classes-per-file": ["error", 1],
    "no-caller": "error",
    "no-cond-assign": "error",
    "no-debugger": "error",
    "no-empty": "error",
    "no-eval": "error",
    "no-new-wrappers": "error",
    "no-shadow": ["error", { hoist: "all" }],
    "no-throw-literal": "error",
    "no-undef-init": "error",
    "no-unsafe-finally": "error",
    "no-unused-labels": "error",
    "no-var": "error",
    "object-shorthand": "error",
    "one-var": ["error", "never"],
    "prefer-const": "error",
    radix: "error",
    "spaced-comment": ["error", "always", { markers: ["/"] }],
    "use-isnan": "error"
}

const frontendRules = {
    ...sharedRules,
    "@typescript-eslint/no-require-imports": "error", // was no-var-requires
    "@typescript-eslint/no-unused-vars": ["error", { varsIgnorePattern: "^_", argsIgnorePattern: "^_" }],
    "id-denylist": ["error", "any", "String", "string", "Boolean", "boolean", "Undefined", "undefined"],
    "no-console": ["error", { allow: ["error", "warn", "info", "assert", "time", "timeEnd"] }],
    "no-underscore-dangle": "off"
}

const electronRules = {
    ...sharedRules,
    "@typescript-eslint/no-require-imports": "off", // electron uses require() for lazy/native loading (was no-var-requires: off)
    "@typescript-eslint/triple-slash-reference": ["error", { path: "always", types: "prefer-import", lib: "always" }],
    "@typescript-eslint/unbound-method": ["error", { ignoreStatic: true }],
    "id-denylist": ["error", "any", "Number", "number", "String", "string", "Boolean", "boolean", "Undefined", "undefined"],
    "no-console": ["error", { allow: ["error", "warn", "info", "time", "timeEnd"] }],
    "no-underscore-dangle": "error"
}

export default tseslint.config(
    // the previous lint only covered src/electron and src/frontend — keep that scope (others aren't in a tsconfig project here)
    { ignores: ["**/build/**", "**/dist/**", "**/node_modules/**", "public/**", "scripts/**", "config/**", "src/types/**", "src/common/**", "src/server/**", "src/frontend/components/output/effects/simplex-noise.js", "*.cjs", "*.mjs"] },

    // NOTE: the previous config did not extend eslint:recommended, only @typescript-eslint's configs — so js.configs.recommended is intentionally omitted to keep behaviour equivalent.
    ...tseslint.configs.recommended,
    ...tseslint.configs.recommendedTypeChecked,

    // ELECTRON (main process)
    {
        files: ["src/electron/**/*.ts"],
        plugins: { jsdoc },
        languageOptions: {
            globals: { ...globals.node },
            parserOptions: { project: "config/typescript/tsconfig.electron.json", tsconfigRootDir: import.meta.dirname + "/../.." }
        },
        rules: electronRules
    },

    // FRONTEND (svelte renderer, .ts/.js)
    {
        files: ["src/frontend/**/*.ts"],
        plugins: { jsdoc },
        languageOptions: {
            globals: { ...globals.browser, ...globals.node },
            parserOptions: { project: "config/typescript/tsconfig.svelte.json", tsconfigRootDir: import.meta.dirname + "/../.." }
        },
        rules: frontendRules
    },

    // SVELTE components — parse with svelte-eslint-parser, lint script with the frontend rules
    {
        files: ["src/frontend/**/*.svelte"],
        plugins: { jsdoc },
        languageOptions: {
            parser: svelteParser,
            globals: { ...globals.browser, ...globals.node },
            parserOptions: { parser: tseslint.parser, project: "config/typescript/tsconfig.svelte.json", tsconfigRootDir: import.meta.dirname + "/../..", extraFileExtensions: [".svelte"] }
        },
        rules: frontendRules
    },

    // Prettier last: turn off all formatting-related rules
    prettier
)
