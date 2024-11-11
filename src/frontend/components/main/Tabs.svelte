<script lang="ts">
    import type { TabsObj } from "../../../types/Tabs"
    import { dictionary, labelsDisabled, openToolsTab } from "../../stores"
    import Icon from "../helpers/Icon.svelte"
    import T from "../helpers/T.svelte"
    import Button from "../inputs/Button.svelte"

    export let tabs: TabsObj
    export let active: string
    export let labels: boolean = $labelsDisabled ? false : true

    $: if ($openToolsTab) openTab()
    function openTab() {
        let tabId = $openToolsTab
        openToolsTab.set("")

        if (!tabs[tabId]) return
        active = tabId
    }

    $: firstOverflowIndex = Object.values(tabs).findIndex((a) => a.overflow)
    export let overflowHidden: boolean = true
</script>

<div class="tabs">
    {#each Object.entries(tabs) as [id, tab]}
        {#if tab.remove !== true && (!tab.overflow || !overflowHidden)}
            <Button on:click={() => (active = id)} active={active === id} disabled={tab.disabled} title={$dictionary.tooltip?.[id]} style="padding: 0.3em 0.5em;{$$props.style || ''}" dark center>
                <Icon id={tab.icon} />
                {#if labels}
                    {#key tab.name}
                        <span style="margin-left: 0.5em;">
                            <T id={tab.name} />
                        </span>
                    {/key}
                {/if}
            </Button>
        {/if}
    {/each}

    {#if firstOverflowIndex > -1 && overflowHidden}
        <Button
            on:click={() => {
                active = Object.keys(tabs)[firstOverflowIndex]
                setTimeout(() => (overflowHidden = false))
            }}
            title={$dictionary.tooltip?.options}
            style="flex: 0;padding: 0.2em;"
            dark
            center
        >
            <Icon id="arrow_right" style="opacity: 0.8;" size={1.2} white />
        </Button>
    {/if}
</div>

<style>
    .tabs {
        display: flex;
        flex-wrap: wrap;
        background-color: var(--primary-darker);
        z-index: 1;
    }

    .tabs :global(button) {
        flex: auto;
    }
</style>
