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
    export let noTopRadius: boolean = false

    let dispatch = createEventDispatcher()
    function setActive(id: string) {
        if (active === id) {
            dispatch("double", id)
            return
        }

        active = id
    }
</script>

<div class="tabs" class:no-top-radius={noTopRadius}>
    {#each Object.entries(tabs) as [id, tab]}
        <Button on:click={() => setActive(id)} title={tab.name} active={active === id} center disabled={!disabled[id]} compact>
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
        border-radius: 12px;
        padding: 4px;
        gap: 4px;
        /* ensure bottom navigation sits above any sticky page controls on mobile */
        position: relative;
        z-index: 3;
        touch-action: manipulation;
    }

    .tabs.no-top-radius {
        border-radius: 0 0 12px 12px;
    }

    .tabs :global(button) {
        flex: auto;
        padding-inline-start: 0 !important;
        padding-inline-end: 0 !important;
        border-radius: 8px;
        margin: 0;
    }

    .label {
        padding-inline-start: 10px;
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
        
        .tabs {
            padding: 2px;
            border-radius: 8px;
            gap: 2px;
        }
        
        .tabs :global(button) {
            padding: 0.3rem 0.4rem;
            min-height: 16px;
        }
    }
</style>
