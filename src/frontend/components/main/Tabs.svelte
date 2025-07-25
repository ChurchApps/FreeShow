<script lang="ts">
    import { onMount } from "svelte"
    import type { TabsObj } from "../../../types/Tabs"
    import { activePage, dictionary, labelsDisabled, openToolsTab } from "../../stores"
    import Icon from "../helpers/Icon.svelte"
    import T from "../helpers/T.svelte"
    import Button from "../inputs/Button.svelte"

    export let tabs: TabsObj
    export let active: string
    export let labels: boolean = $labelsDisabled ? false : true

    let manuallyChanged = false

    $: if ($openToolsTab) openTab()
    function openTab() {
        if ($activePage !== "show" && manuallyChanged) return

        let tabId = $openToolsTab
        openToolsTab.set("")

        if (!tabs[tabId]) return
        active = tabId

        checkOverflow()
    }

    $: firstOverflowIndex = Object.values(tabs).findIndex((a) => a.overflow)
    export let overflowHidden = true

    onMount(checkOverflow)

    function checkOverflow() {
        // show overflow if active is in overflow
        if (active && Object.keys(tabs).find((id) => id === active && tabs[id].overflow)) {
            overflowHidden = false
        }
    }
</script>

<div class="tabs">
    {#each Object.entries(tabs) as [id, tab]}
        {#if tab.remove !== true && (!tab.overflow || !overflowHidden)}
            <Button
                on:click={() => {
                    active = id
                    manuallyChanged = true
                }}
                active={active === id}
                disabled={tab.disabled}
                title={tab.tooltip || $dictionary.tooltip?.[id]}
                style="padding: 0.3em 0.5em;{$$props.style || ''}"
                dark
                center
            >
                <Icon id={tab.icon} />
                {#if labels}
                    {#key tab.name}
                        <span style="margin-inline-start: 0.5em;">
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
            title={$dictionary.tooltip?.options?.replace(".", "")}
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
