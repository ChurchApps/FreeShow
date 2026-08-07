<script lang="ts">
    import { onMount } from "svelte"
    import type { TabsObj } from "../../../types/Tabs"
    import { activePage, dictionary, labelsDisabled, openToolsTab } from "../../stores"
    import { translateText } from "../../utils/language"
    import Icon from "../helpers/Icon.svelte"
    import MaterialButton from "../inputs/MaterialButton.svelte"

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

<div class="tabs" style={$$props.style || null}>
    {#each Object.entries(tabs) as [id, tab]}
        {#if tab.remove !== true && (!tab.overflow || !overflowHidden)}
            <MaterialButton
                style={$$props.style || null}
                on:click={() => {
                    active = id
                    manuallyChanged = true
                }}
                isActive={active === id}
                disabled={tab.disabled}
                title={tab.tooltip || $dictionary.tooltip?.[id] || tab.name}
            >
                <Icon id={tab.icon} white={active === id} />
                {#if labels}
                    {#key tab.name}
                        <span>
                            {translateText(tab.name)}

                            {#if tab.data !== undefined}
                                <span class="badge" class:active={active === id}>{tab.data}</span>
                            {/if}
                        </span>
                    {/key}
                {/if}
            </MaterialButton>
        {/if}
    {/each}

    {#if firstOverflowIndex > -1 && overflowHidden}
        <MaterialButton
            on:click={() => {
                active = Object.keys(tabs)[firstOverflowIndex]
                setTimeout(() => (overflowHidden = false))
            }}
            title={translateText("tooltip.options").replace(".", "")}
            style="flex: 0;padding: 0 1em;"
        >
            <Icon id="arrow_right" style="opacity: 0.8;" size={1.2} white />
        </MaterialButton>
    {/if}
</div>

<style>
    .tabs {
        display: flex;
        flex-wrap: wrap;
        background-color: var(--primary-darker);
        /* one continuous baseline behind every tab (inset, so tabs don't shift) */
        box-shadow: inset 0 -2px 0 var(--primary-lighter);
        z-index: 1;
    }

    .tabs :global(button) {
        flex: auto;

        padding: 0.5em 0.8em;
        border-radius: 0;
        /* keeps inactive tabs the same height as the active one */
        border-bottom: 2px solid transparent;

        opacity: 0.6;
        transition:
            opacity 0.15s ease,
            background 0.2s ease;
    }
    .tabs :global(button:not(:disabled):hover) {
        opacity: 0.85;
    }
    .tabs :global(button.isActive) {
        opacity: 1;
        /* subtle lift instead of the darker "sunken" default */
        background-color: rgb(255 255 255 / 0.04) !important;
    }

    .badge {
        margin-inline-start: 6px;
        padding: 0.1em 0.45em;
        border-radius: 8px;

        background-color: var(--primary-lighter);
        font-size: 0.7em;
        font-weight: 600;
        vertical-align: middle;
    }
    .badge.active {
        background-color: var(--secondary);
        color: var(--secondary-text);
    }
</style>
