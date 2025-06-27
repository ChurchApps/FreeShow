import sveltePreprocess from 'svelte-preprocess'

export default {
  preprocess: sveltePreprocess({
    typescript: {
      tsconfigFile: './config/typescript/tsconfig.svelte.json'
    }
  })
}