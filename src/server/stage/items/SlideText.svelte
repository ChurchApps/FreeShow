<script lang="ts">
  import Textbox from "../components/Textbox.svelte"

  export let slides: any

  export let next: boolean = false
  export let style: boolean = false
  $: slide = slides[next ? 1 : 0]
  let text: string = ""

  $: {
    text = ""
    if (slide) {
      slide.items.forEach((item: any) => {
        item.lines?.forEach((line: any) => {
          // if (text.length) text += "<br />"
          text += line.text.map((t: any) => t.value).join("")
        })
      })
    }
  }
</script>

{#if style}
  {#if slide}
    {#each slide.items as item}
      <Textbox {item} />
    {/each}
  {/if}
{:else}
  {@html text}
{/if}
