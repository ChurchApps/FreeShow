<script lang="ts">
    import { onDestroy } from "svelte"
    import type { EffectItem } from "../../../types/Effects"
    import type { TabsObj } from "../../../types/Tabs"
    import { activeEdit, effects, hoveredEffectItem } from "../../stores"
    import { clone } from "../helpers/array"
    import DragItemWrapper from "../helpers/DragItemWrapper.svelte"
    import { createDragReorder } from "../helpers/dragReorder"
    import Icon from "../helpers/Icon.svelte"
    import T from "../helpers/T.svelte"
    import InputRow from "../input/InputRow.svelte"
    import MaterialColorInput from "../inputs/MaterialColorInput.svelte"
    import MaterialNumberInput from "../inputs/MaterialNumberInput.svelte"
    import Tabs from "../main/Tabs.svelte"
    import EditValues from "./tools/EditValues.svelte"
    import { effectSections } from "./values/effects"

    let tabs: TabsObj = {
        effect: { name: "items.effect", icon: "effects" },
        // filters: { name: "edit.filters", icon: "filter" },
        options: { name: "edit.options", icon: "options", overflow: true }
    }
    let active: string = Object.keys(tabs)[0]

    // update values
    $: effectId = $activeEdit.id || ""
    $: currentEffect = $effects[effectId] || {}

    export function valueChanged(input: any, itemIndex: number) {
        if (!effectId || !currentEffect?.items?.[itemIndex]) return

        effects.update((a) => {
            if (!a[effectId]?.items?.[itemIndex]) return a
            a[effectId].items[itemIndex] = { ...a[effectId].items[itemIndex], [input.id]: input.values.value }
            return a
        })
    }

    function getItemSections(item: EffectItem) {
        if (!effectSections[item.type]) return null
        return { default: clone(effectSections[item.type]) }
    }

    let currentItems: any[]
    $: currentItems = currentEffect.items || []
    $: invertedItems = Array.isArray(currentItems) ? clone(currentItems).reverse() : []

    const dragReorder = createDragReorder((fromIndices, toIndex) => {
        const reordered = dragReorder.getReorderedList(invertedItems, fromIndices, toIndex)
        effects.update((a) => {
            if (!a[effectId]) return a
            a[effectId].items = clone(reordered).reverse()
            return a
        })
    })
    const { dragOverIndex, draggedIndices } = dragReorder

    // close all opened menus when dragging starts
    $: if ($draggedIndices.length) openedMenus = {}

    $: displayList = dragReorder.getReorderedList(invertedItems, $draggedIndices, $dragOverIndex)
    $: isPlaceholderActive = $dragOverIndex !== null

    let openedMenus: { [key: string]: boolean } = {}

    let prevId = ""
    let prevLength = 0
    $: {
        // auto open the menu for a newly added item
        if (effectId === prevId && currentItems.length > prevLength) {
            openedMenus[currentItems.length - 1] = true
        }
        prevId = effectId
        prevLength = currentItems.length
    }

    onDestroy(() => {
        hoveredEffectItem.set(null)
    })
</script>

<div class="main border editTools">
    <Tabs {tabs} bind:active />

    <div class="content">
        {#if active === "effect"}
            {#if currentEffect}
                <div class="items">
                    {#each displayList as item, displayIndex}
                        {@const originalIndex = currentItems.indexOf(item)}
                        {@const index = originalIndex >= 0 ? originalIndex : currentItems.length - displayIndex - 1}
                        {@const editContent = getItemSections(item)}
                        {@const isPlaceholder = isPlaceholderActive && $draggedIndices.some((dIdx) => item === invertedItems[dIdx])}

                        <DragItemWrapper index={displayIndex} controller={dragReorder} {isPlaceholder} handleOnly>
                            <div class="item-row context #effect_item" id={index.toString()} data-index={index} on:mouseenter={() => hoveredEffectItem.set(item.hidden ? null : index)} on:mouseleave={() => hoveredEffectItem.set(null)} role="none">
                                <InputRow arrow={!!editContent} bind:open={openedMenus[index]}>
                                    <div class="title" style={item.hidden ? "opacity: 0.5;" : ""}>
                                        {#if displayList.length > 1}
                                            <span class="drag_handle" style="display: flex;align-items: center;cursor: grab;opacity: 0.6;padding-right: 8px;">
                                                <Icon id="drag_dots" size={1.2} white />
                                            </span>
                                        {/if}

                                        <p style="width: 100%;"><T id="effect.{item.type === 'shape' ? item.shape : item.type}" /></p>
                                    </div>

                                    <svelte:fragment slot="menu">
                                        {#if editContent}
                                            <EditValues sections={editContent} {item} on:change={(e) => valueChanged(e.detail, index)} />
                                        {/if}
                                    </svelte:fragment>
                                </InputRow>
                            </div>
                        </DragItemWrapper>
                    {/each}
                </div>
            {/if}

            <!-- {:else if active === "filters"}
            <EditValues edits={filterEdits} on:change={(e) => valueChanged(e.detail)} /> -->
        {:else if active === "options"}
            <!-- canvas settings -->
            <div class="section">
                <MaterialColorInput
                    label="edit.background_color"
                    value={currentEffect.background}
                    on:input={(e) => {
                        effects.update((a) => {
                            if (!a[effectId]) return a
                            a[effectId].background = e.detail
                            return a
                        })
                    }}
                    allowEmpty
                    noLabel
                />
                <!-- allowGradients -->
                <MaterialNumberInput
                    label="edit.opacity"
                    value={(currentEffect.opacity ?? 1) * 100}
                    max={100}
                    on:change={(e) => {
                        effects.update((a) => {
                            a[effectId].opacity = e.detail / 100
                            return a
                        })
                    }}
                />
            </div>
        {/if}
    </div>
</div>

<style>
    .main {
        display: flex;
        flex-direction: column;
        overflow: hidden;
        height: 100%;
    }

    .content {
        height: 100%;
        overflow-y: auto;
        overflow-x: hidden;

        padding: 10px;
    }

    .items {
        display: flex;
        flex-direction: column;
    }

    .item-row {
        display: flex;
        flex-direction: column;
    }

    .items :global(button) {
        padding: 12px;
    }

    .title {
        display: flex;
        align-items: center;
        flex: 1;
        padding: 0 10px;

        background-color: var(--primary-darker);
    }

    .content :global(.tools) {
        padding: 0;
    }
    .content :global(.section) {
        border: none;
    }
</style>
