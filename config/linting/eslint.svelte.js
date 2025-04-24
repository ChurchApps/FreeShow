module.exports = {
    env: {
        browser: true,
        es2021: true,
        node: true,
    },
    plugins: ["svelte3", "@typescript-eslint", "jsdoc", "prefer-arrow"],
    overrides: [
        {
            files: ["*.svelte"],
            processor: "svelte3/svelte3",
        },
    ],
    extends: ["plugin:@typescript-eslint/recommended", "plugin:@typescript-eslint/recommended-requiring-type-checking", "prettier"],
    parser: "@typescript-eslint/parser",
    parserOptions: {
        project: "tsconfig.svelte.json",
        ecmaVersion: 2021,
        sourceType: "module",
        extraFileExtensions: [".svelte"],
    },
    settings: {
        "svelte3/typescript": () => require("typescript"),
    },
    rules: {
        // Paste your rules here
    },
}
