<script lang="ts">
  import { slide } from "svelte/transition"
  import { createEventDispatcher } from "svelte"
  import { receive, send } from "../../utils/request"
  import { MAIN } from "../../../types/Channels"

  export let system: boolean = false

  const dispatch = createEventDispatcher()

  let fonts: string[] = [
    "CMGSans",
    "Fantasy",
    "Helvetica",
    // "Monaco",
    "Monospace",
    // "sans-serif",
  ]

  send(MAIN, ["GET_SYSTEM_FONTS"])
  receive(MAIN, {
    GET_SYSTEM_FONTS: (systemFonts: string[]) => {
      // join and remove duplicates
      fonts = [...new Set([...fonts, ...systemFonts])]
      // sort
      fonts = fonts.sort((a, b) => a.localeCompare(b))
      // add default app font
      if (system) fonts = ["", ...fonts]
    },
  })

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

<div bind:this={self} class="dropdownElem" style={$$props.style || ""}>
  <button style="font-family: {value};" on:click={() => (active = !active)} on:wheel={wheel}>
    <p>{value || "—"}</p>
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
          <p>{option || "—"}</p>
        </span>
      {/each}
    </div>
  {/if}
</div>

<style>
  .dropdownElem {
    position: relative;
    /* display: grid; */
  }

  div {
    background-color: var(--primary-darker);
    color: var(--text);
  }

  .dropdown {
    max-height: 300px;
    overflow-y: auto;
    overflow-x: hidden;
    /* position: absolute;
    width: 100%; */
    position: fixed;
    display: flex;
    flex-direction: column;
    border: 2px solid var(--primary-lighter);
    transform: translateY(-1px);
    z-index: 10;
  }

  button {
    color: var(--text);
    border: 2px solid var(--primary-lighter);
    text-align: left;
  }

  button,
  span {
    display: table;
    width: 100%;
    padding: 8px 12px;
    background-color: transparent;
    font-family: inherit;
    font-size: 1em;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  span {
    display: flex;
    overflow-x: hidden;
    padding: 12px 10px;
  }
  span p,
  button p {
    opacity: 1;
    height: 20px;
    align-self: center;
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
