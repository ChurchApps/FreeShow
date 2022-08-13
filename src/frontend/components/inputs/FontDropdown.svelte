<script lang="ts">
  import { slide } from "svelte/transition"
  import { createEventDispatcher } from "svelte"

  const dispatch = createEventDispatcher()

  const fonts = [
    "CMGSans",
    "Arial",
    "Calibri",
    "Verdana",
    "Helvetica",
    "Tahoma",
    "sans-serif",
    "Trebuchet MS",
    "Times New Roman",
    "Georgia",
    "Garamond",
    "Courier New",
    "Lucida Console",
    "Monaco",
    "Monospace",
    "Brush Script MT",
    "Lucida Handwriting",
    "Fantasy", // Copperplate
    "Papyrus",
  ]
  // , "Sans-serif"

  // TODO: local fonts
  // getLocalFonts()
  // async function getLocalFonts() {
  //   console.log(1)
  //   try {
  //     const availableFonts = await (window as any).queryLocalFonts()
  //     console.log(availableFonts)
  //     for (const fontData of availableFonts) {
  //       console.log(fontData.postscriptName)
  //       console.log(fontData.fullName)
  //       console.log(fontData.family)
  //       console.log(fontData.style)
  //     }
  //   } catch (err: any) {
  //     console.error(err.name, err.message)
  //   }
  // }

  export let value: string
  let active: boolean = false
  let self: HTMLDivElement

  function wheel(e: any) {
    e.preventDefault()
    let index = fonts.findIndex((a) => a === value)
    if (e.deltaY > 0) index = Math.min(fonts.length - 1, index + 1)
    else index = Math.max(0, index - 1)
    dispatch("click", fonts[index])
  }
</script>

<svelte:window
  on:mousedown={(e) => {
    if (e.target?.closest(".dropdownElem") !== self && active) {
      active = false
    }
  }}
/>

<div bind:this={self} class="dropdownElem" style="position: relative;{$$props.style}">
  <!-- style="font-family: {value};" -->
  <button on:click={() => (active = !active)} on:wheel={wheel}>
    {value}
  </button>
  {#if active}
    <div class="dropdown" transition:slide={{ duration: 200 }}>
      {#each fonts as option}
        <span
          on:click={() => {
            dispatch("click", option)
            active = false
          }}
          class:active={option === value}
          style="font-family: {option};"
        >
          {option}
        </span>
      {/each}
    </div>
  {/if}
</div>

<style>
  div {
    /* width: fit-content;
    min-width: 200px; */
    background-color: var(--primary-darker);
    color: var(--text);
    /* position: relative; */
  }

  .dropdown {
    position: absolute;
    width: 100%;
    display: flex;
    flex-direction: column;
    border: 2px solid var(--primary-lighter);
    transform: translateY(-1px);
    /* transform: translateX(-25%); */
    z-index: 10;
  }

  button {
    /* width: 200px; */
    color: var(--text);
    border: 2px solid var(--primary-lighter);
    /* font-weight: bold; */
    text-align: left;
  }

  button,
  span {
    width: 100%;
    padding: 8px 12px;
    background-color: transparent;
    font-family: inherit;
    /* text-transform: uppercase; */
    font-size: 1em;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  button:hover,
  span:hover {
    background-color: var(--hover);
  }
  span.active {
    background-color: var(--focus);
    color: var(--secondary);
  }
</style>
