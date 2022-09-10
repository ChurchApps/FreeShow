// module.exports = {
//   // transform: {
//   //   "^.+\\.svelte$": "svelte-jester",
//   //   "^.+\\.(t|j)sx?$": "ts-jest",
//   // },
//   transform: {
//     "^.+\\.svelte$": ["svelte-jester", { preprocess: "./svelte.config.test.cjs" }],
//     "^.+\\.ts$": "ts-jest",
//     "^.+\\.js$": "ts-jest",
//   },
//   testRegex: "(/__tests__/.*|(\\.|/)(test|spec))\\.(jsx?|tsx?)$",
//   moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json", "node", "svelte"],
//   transformIgnorePatterns: ["node_modules/?!*"],
// }

// module.exports = {
//   transform: {
//     "^.+\\.svelte$": ["svelte-jester", { preprocess: "./svelte.config.test.cjs" }],
//     "^.+\\.ts$": "ts-jest",
//     "^.+\\.js$": "ts-jest",
//   },
//   moduleFileExtensions: ["js", "ts", "svelte"],
//   moduleNameMapper: {
//     "^\\$lib(.*)$": "src/lib$1",
//     "^\\$app(.*)$": [".svelte-kit/dev/runtime/app$1", ".svelte-kit/build/runtime/app$1"],
//   },
//   // testRegex: "(/tests/.*|(\\.|/)(test|spec))\\.(jsx?|tsx?)$",
//   // collectCoverageFrom: ["src/**/*.{ts,tsx,svelte,js,jsx}"],

//   // setupFilesAfterEnv: ["jest-setup.ts"],
//   // transformIgnorePatterns: ["/node_modules/(?!@vimeo|@vimeo/player)"],
//   transformIgnorePatterns: [
//     "/node_modules/",
//     "src/frontend/components/drawer/player/Vimeo.svelte",
//     "src/frontend/components/system/Player.svelte",
//     "src/frontend/components/output/MediaOutput.svelte",
//     "src/frontend/components/output/Output.svelte",
//     "src/frontend/components/draw/Slide.svelte",
//     "src/frontend/App.svelte",
//     "node_modules/?!(svelte-routing)",
//   ],
// }

module.exports = {
  transform: {
    // "^.+\\.(t|j)sx?$": ["ts-jest", "/tsconfig.svelte.json"],
    "^.+\\.(t|j)sx?$": "ts-jest",
    "^.+\\.svelte$": ["svelte-jester", { preprocess: "./svelte.config.test.cjs" }],
  },
  testEnvironment: "node",
  testRegex: "(/__tests__/.*|(\\.|/)(test|spec))\\.(jsx?|tsx?)$",
  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json", "node"],
  transformIgnorePatterns: ["/node_modules/"],
  // , "src/frontend/components/drawer/player/Vimeo.svelte"
}
