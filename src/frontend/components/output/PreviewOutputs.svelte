<script lang="ts">
  import { onMount } from "svelte"
  import { outputs } from "../../stores"
  import { getActiveOutputs } from "../helpers/output"
  import Button from "../inputs/Button.svelte"

  export let currentOutputId: string | null

  onMount(() => {
    currentOutputId = getActiveOutputs()[0]
  })

  $: outs = Object.entries($outputs)
    .map(([id, o]: any) => ({ id, ...o }))
    .filter((a) => a.enabled)
    .sort((a, b) => a.name.localeCompare(b.name))

  function toggleOutput(e: any, id: string) {
    outputs.update((a) => {
      if (e.ctrlKey || e.metaKey) {
        a[id].active = !a[id].active
        // only disable if another active
        let active = Object.values(a).filter((a) => a.active === true)
        if (!active.length) a[id].active = true
      } else {
        Object.values(a).map((a) => (a.active = false))
        a[id].active = true
      }

      return a
    })

    currentOutputId = getActiveOutputs()[0]
  }
</script>

{#if outs.length > 1}
  <div>
    {#each outs as output}
      <Button
        on:click={(e) => toggleOutput(e, output.id)}
        active={output.active}
        style="flex: 1;{output.active ? 'border-bottom: 2px solid ' + output.color + ' !important;' : ''}"
        bold={false}
        center
        dark
      >
        {output.name}
      </Button>
    {/each}
  </div>
{/if}

<style>
  div {
    display: flex;
    overflow-x: auto;
  }

  div :global(button) {
    cursor: pointer;
    border-bottom: 2px solid var(--primary-lighter) !important;
    white-space: nowrap;
  }
  div :global(button.active:hover) {
    filter: brightness(0.8);
  }
</style>
