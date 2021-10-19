<script lang="ts">
  import icons from "./icons"

  export let name: string
  export let width: string = "1rem"
  export let height: string = "1rem"
  export let box: number = 24

  // {
  //   box: 24,
  //   name: 'save',
  //   svg: `<g stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><path d="M17 21v-8H7v8"/><path d="M7 3v5h8"/></g>`
  // },
  // {
  //   box: 32,
  //   name: 'trash',
  //   svg: `<path d="M12 12h2v12h-2z" /><path d="M18 12h2v12h-2z" /><path d="M4 6v2h2v20a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8h2V6zm4 22V8h16v20z" /><path d="M12 2h8v2h-8z" />`
  // }
  // let displayIcon = icons.find((e) => e.name === name);
</script>

<svg class={$$props.class} style="{$$props.style || ''} min-width: {width}" {width} {height} viewBox="0 0 {box} {box}">{@html icons[name]}</svg>

<style>
  svg {
    fill: var(--secondary);
  }
</style>
