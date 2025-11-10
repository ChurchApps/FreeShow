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
                style="border-bottom: 2px solid var(--primary-darker);{$$props.style || ''}"
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
                        <span>{translateText(tab.name)}</span>
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
        z-index: 1;
    }

    .tabs :global(button) {
        flex: auto;

        padding: 0.3em 0.5em;
        border-radius: 0;
    }
</style>
