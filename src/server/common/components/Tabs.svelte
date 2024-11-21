<script lang="ts">
    import type { TabsObj } from "../../../types/Tabs"
    import Icon from "./Icon.svelte"
    // import T from "../helpers/T.svelte"
    import Button from "./Button.svelte"
    import { createEventDispatcher } from "svelte"

    export let tabs: TabsObj
    export let active: string
    export let disabled: any
    export let icons: boolean = false

    let dispatch = createEventDispatcher()
    function setActive(id: string) {
        if (active === id) {
            dispatch("double", id)
            return
        }

        active = id
    }
</script>

<div class="tabs">
    {#each Object.entries(tabs) as [id, tab]}
        <Button on:click={() => setActive(id)} title={tab.name} active={active === id} center disabled={!disabled[id]}>
            <Icon id={tab.icon} size={2} />
            <!-- {#if labels}
        <T id={tab.name} />
      {/if} -->
            {#if !icons}
                <span class="label">{tab.name}</span>
            {/if}
        </Button>
    {/each}
</div>

<style>
    .tabs {
        display: flex;
        flex-wrap: wrap;
        background-color: var(--primary-darkest);
    }

    .tabs :global(button) {
        flex: auto;
        padding-left: 0 !important;
        padding-right: 0 !important;
    }

    .label {
        padding-left: 10px;
    }

    /* @media screen and (max-width: 1500px) {
    .label {
      font-size: 0.8em;
    }
  }
  @media screen and (max-width: 1200px) {
    .label {
      font-size: 0.5em;
    }
  } */
    @media screen and (max-width: 800px) {
        .label {
            display: none;
        }
    }
</style>
