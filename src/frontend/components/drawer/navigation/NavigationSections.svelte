<script lang="ts">
    import { activeActionTagFilter, activeDrawerTab, activeEdit, activeVariableTagFilter, drawerTabsData, labelsDisabled } from "../../../stores"
    import { translateText } from "../../../utils/language"
    import MaterialDrawerTab from "../MaterialDrawerTab.svelte"

    // interface Button extends Category {
    //     label: string
    //     id: string
    //     url?: string
    //     length?: number
    //     readOnly?: boolean
    // }

    export let sections: any[]
    export let active: string

    $: if (sections.length && (!active || !sections.flat().find((a) => a.id === active))) {
        const flat = sections.flat().filter((a) => a && a !== "SEPARATOR" && a.id !== "SEPARATOR" && a.id !== "TITLE")
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

    function notATab(tab: any) {
        if (tab === "SEPARATOR") return true
        if (tab?.id === "SEPARATOR") return true
        if (tab?.id === "TITLE") return true
        return false
    }
    function keydown(e: KeyboardEvent) {
        if ($activeEdit.items.length) return
        if (e.target?.closest(".edit") || !(e.ctrlKey || e.metaKey)) return

        const flatSections = sections.flat().filter((a) => !a.hidden)

        // Ctrl + Arrow Up/Down = change active drawer sub tab
        if (e.key === "ArrowDown") {
            let index = flatSections.findIndex((a) => a.id === active)
            let nextIndex = index + 1

            while (nextIndex < flatSections.length && notATab(flatSections[nextIndex])) nextIndex++

            if (nextIndex < flatSections.length) setSubTab(flatSections[nextIndex].id)
        } else if (e.key === "ArrowUp") {
            let index = flatSections.findIndex((a) => a.id === active)
            let nextIndex = index - 1

            while (nextIndex >= 0 && notATab(flatSections[nextIndex])) nextIndex--

            if (nextIndex >= 0) setSubTab(flatSections[nextIndex].id)
        }
    }
</script>

<svelte:window on:keydown={keydown} />

<div class="tabSection">
    {#each sections as buttons, index}
        {#if buttons.length > 1 || !buttons[0]?.hidden}
            <div class="section">
                {#if buttons.length}
                    {#each buttons as category}
                        {#if category?.id === "TITLE"}
                            <div class="title">{translateText(category.label)}</div>

                            {#if $labelsDisabled}
                                <div class="add_button">
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
                        {:else if category === "SEPARATOR" || category?.id === "SEPARATOR"}
                            <div class="separator">
                                {#if category?.label}<div class="sepLabel">{translateText(category.label)}</div>{/if}
                                <hr />
                            </div>
                        {:else if !category.hidden}
                            <MaterialDrawerTab {active} {category} on:rename />
                        {/if}
                    {/each}
                    <!-- {:else}
            <Center style="padding: 10px;" faded>
                <T id="empty.general" />
            </Center> -->
                {/if}

                {#if !$labelsDisabled}
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
        position: relative;

        background-color: var(--primary-darker);
        border: 1px solid var(--primary-lighter);
        margin: 0 5px;
        border-radius: 10px;

        display: flex;
        flex-direction: column;

        overflow: hidden;

        /* align to left */
        margin-left: 0;
        border-top-left-radius: 0;
        border-bottom-left-radius: 0;
        border-left-width: 0;
    }

    .title {
        font-weight: 500;
        padding: 4px 14px;
        font-size: 0.8rem;
        opacity: 0.8;
        background: var(--primary-darkest);
        border-bottom: 1px solid var(--primary-lighter);
    }

    hr {
        height: 1px;
        border: none;
        background-color: var(--primary-lighter);
        flex: 1;
        opacity: 0.8;
    }

    .separator {
        display: flex;
        align-items: center;
    }
    .sepLabel {
        font-size: 0.6rem;
        color: var(--text);
        opacity: 0.5;
        padding: 6px 14px;
        line-height: 1;
    }

    .add_button {
        position: absolute;
        top: 0;
        right: 2px;
    }
    .add_button :global(div) {
        padding: 0 !important;
    }
    .add_button :global(button) {
        padding: 4px;
        border: none;
    }
</style>
