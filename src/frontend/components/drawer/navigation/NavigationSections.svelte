<script lang="ts">
    import { activeActionTagFilter, activeDrawerTab, activeEdit, activeVariableTagFilter, drawerTabsData } from "../../../stores"
    import MaterialDrawerTab from "../MaterialDrawerTab.svelte"
    import T from "../../helpers/T.svelte"

    // interface Button extends Category {
    //     label: string
    //     id: string
    //     url?: string
    //     length?: number
    //     readOnly?: boolean
    // }

    export let sections: any[]
    export let active: string
    // Optional selection mode for callers that want checkboxes on each item
    export let showSelectors: boolean = false
    export let selectHandler: null | ((id: string) => void) = null
    export let isSelected: null | ((id: string) => boolean) = null
    export let canSelect: null | ((id: string) => boolean) = null

    $: if (sections.length && !active) {
        const flat = sections.flat().filter((a) => a && a !== "SEPERATOR")
        if (flat.length) setSubTab(flat[0].id)
    }

    function setSubTab(tabId: string) {
        const drawerId = $activeDrawerTab
        drawerTabsData.update((a) => {
            a[drawerId] = { activeSubTab: tabId, enabled: a[drawerId]?.enabled !== false }
            return a
        })

        // tag submenus will close on keyboard navigation
        activeActionTagFilter.set([])
        activeVariableTagFilter.set([])
    }

    function keydown(e: KeyboardEvent) {
        if ($activeEdit.items.length) return
        if (e.target?.closest(".edit") || !(e.ctrlKey || e.metaKey)) return

        const flatSections = sections.flat().filter((a) => !a.hidden)

        // Ctrl + Arrow Up/Down = change active drawer sub tab
        if (e.key === "ArrowDown") {
            let index = flatSections.findIndex((a) => a.id === active)
            let nextIndex = index + 1

            while (nextIndex < flatSections.length && flatSections[nextIndex] === "SEPERATOR") nextIndex++

            if (nextIndex < flatSections.length) setSubTab(flatSections[nextIndex].id)
        } else if (e.key === "ArrowUp") {
            let index = flatSections.findIndex((a) => a.id === active)
            let nextIndex = index - 1

            while (nextIndex >= 0 && flatSections[nextIndex] === "SEPERATOR") nextIndex--

            if (nextIndex >= 0) setSubTab(flatSections[nextIndex].id)
        }
    }
</script>

<svelte:window on:keydown={keydown} />

<div class="tabSection">
    {#each sections as buttons, index}
        {#if buttons.length > 1 || !buttons[0]?.hidden || (index === 0 && buttons.length > 0)}
            <div class="section">
                {#if index === 0}
                    <slot name="header_0" />
                {:else if index === 1}
                    <slot name="header_1" />
                {:else if index === 2}
                    <slot name="header_2" />
                {:else if index === 3}
                    <slot name="header_3" />
                {:else if index === 4}
                    <slot name="header_4" />
                {/if}

                {#if buttons.length}
                    {#each buttons as category}
                        {#if category === "SEPERATOR"}
                            <div class="separator">
                                <hr />
                                <div class="sepLabel"><T id="scripture.api_label" /></div>
                            </div>
                        {:else if !category.hidden}
                            <MaterialDrawerTab {active} {category} on:rename showSelector={showSelectors} selectHandler={selectHandler} isSelected={isSelected} canSelect={canSelect} />
                        {/if}
                    {/each}
                    <!-- {:else}
            <Center style="padding: 10px;" faded>
                <T id="empty.general" />
            </Center> -->
                {/if}

                {#if index === 0}
                    <slot name="section_0" />
                {:else if index === 1}
                    <slot name="section_1" />
                {:else if index === 2}
                    <slot name="section_2" />
                {:else if index === 3}
                    <slot name="section_3" />
                {:else if index === 4}
                    <slot name="section_4" />
                {/if}
            </div>
        {/if}
    {/each}
</div>

<style>
    .tabSection {
        display: flex;
        flex-direction: column;
        gap: 5px;
        padding: 8px 0;
    }

    .section {
        background-color: var(--primary-darker);
        border: 1px solid var(--primary-lighter);
        margin: 0 5px;
        border-radius: 10px;

        display: flex;
        flex-direction: column;

    overflow: hidden;
    padding: 6px;

        /* align to left */
        margin-left: 0;
        border-top-left-radius: 0;
        border-bottom-left-radius: 0;
        border-left-width: 0;
    }

    .section :global(button:not(.outlined)) {
        /* border-bottom: 1px solid var(--primary-darker); */
        border-left: 4px solid var(--primary-darker);
        border-radius: 0;

        justify-content: space-between;
    }

    hr {
        height: 1px;
        border: none;
    background-color: var(--primary-lighter);
    flex: 1 1 auto;
    }

.separator { display: flex; align-items: center; gap: 8px; }
.sepLabel { font-size: 0.65rem; color: var(--secondary-text, rgba(255,255,255,0.65)); font-weight:400; margin-left:6px }
</style>
