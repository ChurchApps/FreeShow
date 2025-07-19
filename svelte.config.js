import sveltePreprocess from 'svelte-preprocess'

const production = process.env.NODE_ENV === 'production'

export default {
  preprocess: sveltePreprocess({
    typescript: {
      tsconfigFile: `./config/typescript/tsconfig.svelte${production ? '.prod' : ''}.json`,
    },
  }),
}