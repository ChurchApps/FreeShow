<script lang="ts">
    import { onDestroy } from "svelte"
    import type { TabsObj } from "../../../types/Tabs"
    import { activeEdit, activePage, activePopup, activeStyle, overlays, popupData, refreshEditSlide, scenes, selected, settingsTab, styles } from "../../stores"
    import { translateText } from "../../utils/language"
    import DragItemWrapper from "../helpers/DragItemWrapper.svelte"
    import { clone } from "../helpers/array"
    import { createDragReorder } from "../helpers/dragReorder"
    import { history } from "../helpers/history"
    import Icon from "../helpers/Icon.svelte"
    import { updateActiveSceneOutputs } from "../helpers/output"
    import InputRow from "../input/InputRow.svelte"
    import MaterialButton from "../inputs/MaterialButton.svelte"
    import MaterialPopupButton from "../inputs/MaterialPopupButton.svelte"
    import Tabs from "../main/Tabs.svelte"

    let tabs: TabsObj = {
        scene: { name: "tools.scene", icon: "scene" }
    }
    let active: string = Object.keys(tabs)[0]

    $: sceneId = $activeEdit.id || ""
    $: scene = $scenes[sceneId] || {}
    $: content = scene.content || {}

    $: styleId = content?.style || ""
    function editStyle() {
        activeStyle.set(styleId)
        settingsTab.set("styles")
        activePage.set("settings")
    }

    function updateContent(key: string, data: any, shouldOverride = false) {
        if (!sceneId) return

        const newContent = { ...clone(scene.content || {}), [key]: data }
        history({
            id: "UPDATE",
            newData: { key: "content", data: newContent },
            oldData: { id: sceneId },
            location: { page: "drawer", id: "scene_key", ...(shouldOverride ? { override: `content_${key}_${sceneId}` } : {}) }
        })

        updateActiveSceneOutputs(sceneId)
        refreshEditSlide.set(true)
    }

    // Overlays
    $: overlaysList = (content.overlays || []) as string[]
    $: invertedOverlaysList = Array.isArray(overlaysList) ? clone(overlaysList).reverse() : []

    const dragReorder = createDragReorder((fromIndices, toIndex) => {
        const reordered = dragReorder.getReorderedList(invertedOverlaysList, fromIndices, toIndex)
        const newOverlays = clone(reordered).reverse()
        updateContent("overlays", newOverlays)
        if ($selected.id === "scene_overlay" && $selected.data?.[0]?.id) {
            const newIndex = newOverlays.indexOf($selected.data[0].id)
            if (newIndex >= 0) selected.set({ id: "scene_overlay", data: [{ id: $selected.data[0].id, index: newIndex }] })
        }
    })
    const { dragOverIndex, draggedIndices } = dragReorder

    $: displayOverlays = dragReorder.getReorderedList(invertedOverlaysList, $draggedIndices, $dragOverIndex)
    $: isPlaceholderActive = $dragOverIndex !== null
    $: selectedIndices = $selected.id === "scene_overlay" && $selected.data?.[0]?.index !== undefined ? [invertedOverlaysList.length - 1 - $selected.data[0].index] : []

    function openAddOverlay() {
        popupData.set({
            hide: overlaysList,
            trigger: (value) => addOverlay(value)
        })

        activePopup.set("select_overlay")
    }

    function addOverlay(overlayId: string) {
        if (!overlayId || overlaysList.includes(overlayId)) return

        const currentOverlays = clone(overlaysList)
        currentOverlays.push(overlayId)
        updateContent("overlays", currentOverlays)

        // set name
        overlays.update((a) => {
            if (scene.name && a[overlayId] && !a[overlayId].name) {
                a[overlayId].name = scene.name
            }
            return a
        })
    }

    // function editOverlay(index: number) {
    //     const overlayId = overlaysList[index]
    //     if (!overlayId) return

    //     refreshEditSlide.set(true)

    //     activePage.set("edit") // should already be "edit"
    //     activeEdit.set({ type: "overlay", id: overlayId, items: [] })
    // }

    function toggleSelectOverlay(index: number, overlayId: string) {
        if ($selected.id === "scene_overlay" && $selected.data?.[0]?.index === index) {
            selected.set({ id: null, data: [] })
        } else {
            selected.set({ id: "scene_overlay", data: [{ id: overlayId, index }] })
        }
    }

    function deselectOverlay() {
        if ($selected.id === "scene_overlay") {
            selected.set({ id: null, data: [] })
        }
    }

    onDestroy(() => {
        deselectOverlay()
    })
</script>

<div
    class="main border editTools"
    on:click={(e) => {
        if (!e.target?.closest(".overlay-item") && !e.target?.closest(".contextMenu")) deselectOverlay()
    }}
    role="none"
>
    <Tabs {tabs} bind:active />

    <div class="content">
        <!-- Choose media input -->
        <MaterialPopupButton label="popup.choose_media_input" value={content.media} name={content.media?.name || content.media?.id || ""} icon={content.media?.type || "camera"} popupId="choose_media_input" on:change={(e) => updateContent("media", e.detail || null)} allowEmpty />

        <!-- Output style -->
        <InputRow style="margin-top: 5px;">
            <!-- <MaterialPopupButton label="actions.id_select_output_style" value={styleId || "empty"} name={styleId ? $styles[styleId]?.name || "" : "main.empty"} icon="styles" popupId="select_style" on:change={(e) => updateContent("style", e.detail || "")} allowEmpty={!!styleId} /> -->
            <MaterialPopupButton label="actions.id_select_output_style" value={styleId} name={$styles[styleId]?.name || ""} icon="styles" popupId="select_style" on:change={(e) => updateContent("style", e.detail || "")} allowEmpty />
            {#if $styles[styleId]}
                <MaterialButton title="titlebar.edit" icon="edit" on:click={editStyle} />
            {/if}
        </InputRow>

        <!-- Overlays -->
        <div style="margin-top: 10px;">
            <div class="title">
                <span style="display: flex;gap: 8px;align-items: center;padding: 8px 12px;">
                    <Icon id="overlays" white />
                    <p>{translateText("tabs.overlays")}</p>
                </span>
            </div>

            <div class="items" style="display: flex;flex-direction: column;">
                {#each displayOverlays as overlayId, displayIndex (overlayId)}
                    {@const overlayObj = $overlays[overlayId]}
                    {@const isHidden = (content.hiddenOverlays || []).includes(overlayId)}
                    {@const originalIndex = overlaysList.indexOf(overlayId)}
                    {@const index = originalIndex >= 0 ? originalIndex : overlaysList.length - displayIndex - 1}
                    {@const isPlaceholder = isPlaceholderActive && $draggedIndices.some((dIdx) => overlayId === invertedOverlaysList[dIdx])}

                    <DragItemWrapper index={displayIndex} controller={dragReorder} {isPlaceholder} {selectedIndices}>
                        <div
                            id="#{index}"
                            data-index={index}
                            data-overlay-id={overlayId}
                            class="overlay-item context #scene_overlay"
                            class:selected={$selected.id === "scene_overlay" && $selected.data?.[0]?.index === index}
                            on:click={() => toggleSelectOverlay(index, overlayId)}
                            on:mousedown={(e) => {
                                if (e.button === 2) {
                                    selected.set({ id: "scene_overlay", data: [{ id: overlayId, index }] })
                                }
                            }}
                            role="none"
                        >
                            <!-- on:dblclick={() => editOverlay(index)} -->
                            <div class="item-title" style={isHidden ? "opacity: 0.5;" : ""}>
                                {#if displayOverlays.length > 1}
                                    <Icon id="drag" style="opacity: 0.5; margin-right: 2px;" white />
                                {/if}

                                <p style="font-size: 0.9em; flex: 1;">{overlayObj?.name || translateText("main.unnamed")}</p>
                                <span style="font-size: 0.75em;opacity: 0.5;min-width: 12px;text-align: right;">{displayIndex + 1}</span>
                            </div>
                        </div>
                    </DragItemWrapper>
                {/each}
            </div>

            <MaterialButton variant="outlined" icon="add" style="width: 100%;" on:click={openAddOverlay}>
                {translateText("edit.overlay_content")}
            </MaterialButton>
        </div>
    </div>
</div>

<style>
    .main {
        display: flex;
        flex-direction: column;

        height: 100%;

        overflow: hidden;
    }

    .content {
        display: flex;
        flex-direction: column;

        padding: 10px;
        height: 100%;

        overflow-y: auto;
        overflow-x: hidden;
    }

    .overlay-item {
        display: flex;
        min-height: 32px;

        background-color: var(--primary-darkest);
        border-bottom: 1px solid var(--primary-lighter);
        user-select: none;
        cursor: grab;
    }

    .overlay-item:hover,
    .overlay-item.selected {
        background-color: var(--active);
    }

    .overlay-item :global(button) {
        padding: 8px;
    }

    .item-title {
        display: flex;
        align-items: center;
        gap: 8px;
        flex: 1;

        padding: 0 8px;
        overflow: hidden;
    }

    /* title */

    .title {
        background-color: var(--primary-darker);
        border-bottom: 1px solid var(--primary-lighter);

        border-top-left-radius: 10px;
        border-top-right-radius: 10px;
        overflow: hidden;
    }
    .title p {
        font-weight: 500;
        font-size: 0.8rem;
        opacity: 0.8;
    }
</style>
