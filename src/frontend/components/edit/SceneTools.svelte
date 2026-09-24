<script lang="ts">
    import type { TabsObj } from "../../../types/Tabs"
    import { activeEdit, activePage, activePopup, activeStyle, overlays, popupData, refreshEditSlide, scenes, settingsTab, styles } from "../../stores"
    import { translateText } from "../../utils/language"
    import { getAccess } from "../../utils/profile"
    import { clone } from "../helpers/array"
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

    $: profile = getAccess("scenes")
    $: readOnly = profile.global === "read" || profile[sceneId] === "read"

    $: styleId = content?.style || ""
    function editStyle() {
        activeStyle.set(styleId)
        settingsTab.set("styles")
        activePage.set("settings")
    }

    function updateContent(key: string, data: any) {
        if (!sceneId || readOnly) return

        const newContent = { ...clone(scene.content || {}), [key]: data }
        history({
            id: "UPDATE",
            newData: { key: "content", data: newContent },
            oldData: { id: sceneId },
            location: { page: "drawer", id: "scene_key", override: `content_${key}_${sceneId}` }
        })

        updateActiveSceneOutputs(sceneId)
    }

    // Overlays
    $: overlaysList = (content.overlays || []) as string[]

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

    function removeOverlay(index: number) {
        if (readOnly) return

        const currentOverlays = clone(overlaysList)
        currentOverlays.splice(index, 1)

        updateContent("overlays", currentOverlays)
    }

    function moveOverlay(index: number, direction: number) {
        if (readOnly) return

        const currentOverlays = clone(overlaysList)
        const targetIndex = index + direction
        if (targetIndex < 0 || targetIndex >= currentOverlays.length) return

        const temp = currentOverlays[index]
        currentOverlays[index] = currentOverlays[targetIndex]
        currentOverlays[targetIndex] = temp

        updateContent("overlays", currentOverlays)
    }

    function editOverlay(index: number) {
        const overlayId = overlaysList[index]
        if (!overlayId) return

        refreshEditSlide.set(true)

        activePage.set("edit") // should already be "edit"
        activeEdit.set({ type: "overlay", id: overlayId, items: [] })
    }

    function openAddOverlay() {
        popupData.set({
            hide: overlaysList,
            trigger: (value) => addOverlay(value)
        })

        activePopup.set("select_overlay")
    }
</script>

<div class="main border editTools">
    <Tabs {tabs} bind:active />

    <div class="content">
        <!-- Choose media input -->
        <MaterialPopupButton disabled={readOnly} label="popup.choose_media_input" value={content.media} name={content.media?.name || content.media?.id || ""} icon={content.media?.type || "camera"} popupId="choose_media_input" on:change={(e) => updateContent("media", e.detail || null)} allowEmpty />

        <!-- Output style -->
        <InputRow style="margin-top: 5px;">
            <!-- <MaterialPopupButton label="actions.id_select_output_style" value={styleId || "empty"} name={styleId ? $styles[styleId]?.name || "" : "main.empty"} icon="styles" popupId="select_style" on:change={(e) => updateContent("style", e.detail || "")} allowEmpty={!!styleId} /> -->
            <MaterialPopupButton disabled={readOnly} label="actions.id_select_output_style" value={styleId} name={$styles[styleId]?.name || ""} icon="styles" popupId="select_style" on:change={(e) => updateContent("style", e.detail || "")} allowEmpty />
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

            <div
                class="items {overlaysList.length > 1 ? 'context #items_list_item' : ''}"
                style="display: flex;flex-direction: column;"
                on:mousedown={(e) => {
                    if (e.button !== 2) return
                    // select on right click for context menu
                    const index = Number((e.target?.closest(".item_button")?.id || "").slice(1))
                    activeEdit.set({ ...$activeEdit, items: [index] })
                }}
            >
                {#each overlaysList as overlayId, index (index + "_" + overlayId)}
                    {@const overlayObj = $overlays[overlayId]}
                    <div class="overlay-item">
                        <div class="item-title">
                            <span style="font-size: 0.75em;opacity: 0.5;min-width: 12px;text-align: center;">{index + 1}</span>
                            <p style="font-size: 0.9em;">{overlayObj?.name || translateText("main.unnamed")}</p>
                        </div>

                        {#if index < overlaysList.length - 1}
                            <MaterialButton disabled={readOnly} class="down" icon="down" on:click={() => moveOverlay(index, 1)} />
                        {/if}
                        {#if index > 0}
                            <MaterialButton disabled={readOnly} class="up" icon="up" on:click={() => moveOverlay(index, -1)} />
                        {/if}

                        <MaterialButton disabled={readOnly} title="actions.delete" on:click={() => removeOverlay(index)}>
                            <Icon id="delete" size={0.9} white />
                        </MaterialButton>

                        <MaterialButton title="menu.edit" on:click={() => editOverlay(index)}>
                            <Icon id="edit" size={0.9} white />
                        </MaterialButton>
                    </div>
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

        background-color: var(--primary-darkest);
        border-bottom: 1px solid var(--primary-lighter);
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
