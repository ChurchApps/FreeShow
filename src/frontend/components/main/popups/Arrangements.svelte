<script lang="ts">
    import type { SlideData } from "../../../../types/Show"
    import { activeProject, activeRename, activeShow, cachedShowsData, groups, popupData, projects, showsCache } from "../../../stores"
    import { translateText } from "../../../utils/language"
    import { getAccess } from "../../../utils/profile"
    import { createArrangement, deleteArrangement, getDefaultLayout, renameArrangement, selectArrangement, setArrangementSlides, setDefaultLayout } from "../../helpers/arrangements"
    import { keysToID, sortByName } from "../../helpers/array"
    import Icon from "../../helpers/Icon.svelte"
    import T from "../../helpers/T.svelte"
    import MaterialButton from "../../inputs/MaterialButton.svelte"
    import MaterialTextInput from "../../inputs/MaterialTextInput.svelte"
    import { getSlideGroups } from "../../show/tools/groups"

    // opened for a project item in a list, or for the open show
    const projectIndex: number | undefined = $popupData.projectIndex
    const showId: string = $popupData.showId || $activeShow?.id || ""
    $: show = $showsCache[showId]
    $: arrangements = sortByName(keysToID(show?.layouts || {}))
    $: defaultId = getDefaultLayout(show)
    $: itemLayout = projectIndex !== undefined ? $projects[$activeProject || ""]?.shows?.[projectIndex]?.layout : ""
    $: activeId = projectIndex !== undefined ? (itemLayout && show?.layouts?.[itemLayout] ? itemLayout : defaultId) : show?.settings?.activeLayout || ""
    $: arrangement = show?.layouts?.[activeId]
    $: sequence = (arrangement?.slides || []) as SlideData[]

    let profile = getAccess("shows")
    $: isLocked = !!show?.locked || profile.global === "read" || profile[show?.category || ""] === "read"

    // the show's groups, named, numbered and colored as in the slide grid
    $: showGroups = (getSlideGroups(showId, $showsCache, $cachedShowsData) as any[]).filter((a) => a.group !== ".")
    $: groupInfo = Object.fromEntries(showGroups.map((a) => [a.id, { name: a.group || "—", color: $groups[show?.slides?.[a.id]?.globalGroup || ""]?.color || show?.slides?.[a.id]?.color || "" }]))
    // slide order is creation order, so the palette stays put while the arrangement changes
    $: paletteOrder = Object.keys(show?.slides || {}).filter((id) => groupInfo[id])

    function updateSequence(slides: SlideData[]) {
        if (isLocked || !activeId) return
        setArrangementSlides(showId, activeId, slides)
    }

    function addGroup(slideId: string, at = sequence.length) {
        updateSequence([...sequence.slice(0, at), { id: slideId }, ...sequence.slice(at)])
    }

    function removeAt(index: number) {
        updateSequence(sequence.filter((_a, i) => i !== index))
    }

    function newArrangement(copy = false) {
        const name = copy ? `${arrangement?.name || translateText("main.unnamed")} 2` : translateText("show.new_arrangement")
        const id = createArrangement(showId, name, copy ? activeId : "")
        if (projectIndex !== undefined) selectArrangement(showId, id, projectIndex)
        // named here, not in the bottom bar
        activeRename.set(null)
    }

    // DRAG AND DROP

    let dragged: { from: "palette" | "sequence"; id: string; index: number } | null = null
    let dropIndex = -1

    function dragStart(e: DragEvent, from: "palette" | "sequence", id: string, index = -1) {
        if (isLocked) return
        dragged = { from, id, index }
        e.dataTransfer?.setData("text/plain", id)
        if (e.dataTransfer) e.dataTransfer.effectAllowed = "move"
    }

    function dragOver(e: DragEvent, index: number) {
        if (!dragged) return
        e.preventDefault()
        dropIndex = index
    }

    function drop(e: DragEvent) {
        e.preventDefault()
        if (!dragged) return
        const at = dropIndex < 0 ? sequence.length : dropIndex

        if (dragged.from === "palette") addGroup(dragged.id, at)
        else if (at !== dragged.index && at !== dragged.index + 1) {
            const moved = sequence[dragged.index]
            const rest = sequence.filter((_a, i) => i !== dragged!.index)
            const target = at > dragged.index ? at - 1 : at
            updateSequence([...rest.slice(0, target), moved, ...rest.slice(target)])
        }

        dragEnd()
    }

    function dragEnd() {
        dragged = null
        dropIndex = -1
    }
</script>

<div class="arrangements">
    <div class="list">
        {#each arrangements as layout}
            <MaterialButton class="arrangement" isActive={layout.id === activeId} on:click={() => selectArrangement(showId, layout.id, projectIndex)}>
                <p>{layout.name || translateText("main.unnamed")}</p>
                {#if layout.id === defaultId}<span class="star" data-title={translateText("show.default_arrangement")}><Icon id="star" size={0.8} white /></span>{/if}
            </MaterialButton>
        {/each}

        <MaterialButton icon="add" disabled={isLocked} on:click={() => newArrangement()}>
            <T id="show.new_arrangement" />
        </MaterialButton>
    </div>

    <div class="editor">
        {#if arrangement}
            <div class="row">
                <MaterialTextInput label="show.name" value={arrangement.name} disabled={isLocked} on:change={(e) => renameArrangement(showId, activeId, e.detail)} />
            </div>

            <div class="row">
                <MaterialButton icon="star" disabled={activeId === defaultId || isLocked} title="show.make_default_tip" on:click={() => setDefaultLayout(showId, activeId)} white={activeId !== defaultId}>
                    <T id={activeId === defaultId ? "show.default_arrangement" : "show.make_default"} />
                </MaterialButton>
                <MaterialButton icon="duplicate" disabled={isLocked} on:click={() => newArrangement(true)}>
                    <T id="actions.duplicate" />
                </MaterialButton>
                <MaterialButton icon="delete" disabled={isLocked || arrangements.length < 2} on:click={() => deleteArrangement(showId, activeId)}>
                    <T id="actions.delete" />
                </MaterialButton>
            </div>

            <h4><T id="tools.groups" /></h4>
            <p class="tip"><T id="show.arrangement_groups_tip" /></p>
            <div class="chips">
                {#each paletteOrder as slideId}
                    <button class="chip" style="--color: {groupInfo[slideId]?.color || 'transparent'};" draggable={!isLocked} disabled={isLocked} on:click={() => addGroup(slideId)} on:dragstart={(e) => dragStart(e, "palette", slideId)} on:dragend={dragEnd}>
                        {groupInfo[slideId]?.name}
                    </button>
                {/each}
            </div>

            <h4><T id="show.arrangement_order" /></h4>
            <p class="tip"><T id="show.arrangement_order_tip" /></p>
            <div class="chips sequence" class:dragging={!!dragged} role="list" on:dragover={(e) => dragOver(e, -1)} on:drop={drop}>
                {#each sequence as ref, i}
                    <div class="chip" class:dropBefore={dropIndex === i} class:disabledSlide={ref.disabled} style="--color: {groupInfo[ref.id]?.color || 'transparent'};" role="listitem" draggable={!isLocked} on:dragstart={(e) => dragStart(e, "sequence", ref.id, i)} on:dragend={dragEnd} on:dragover|stopPropagation={(e) => dragOver(e, i)}>
                        <span>{groupInfo[ref.id]?.name || "—"}</span>
                        {#if !isLocked}
                            <button class="remove" data-title={translateText("actions.remove")} on:click={() => removeAt(i)}><Icon id="close" size={0.7} white /></button>
                        {/if}
                    </div>
                {:else}
                    <p class="empty"><T id="show.arrangement_empty" /></p>
                {/each}
            </div>
        {/if}
    </div>
</div>

<style>
    .arrangements {
        display: flex;
        gap: 15px;
        width: 100%;
        min-width: 700px;
        min-height: 300px;
    }

    .list {
        display: flex;
        flex-direction: column;
        gap: 2px;
        width: 220px;
        flex-shrink: 0;
        padding-inline-end: 15px;
        border-inline-end: 1px solid var(--primary-lighter);
    }

    .list :global(.arrangement) {
        justify-content: space-between;
    }
    .list p {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }
    .star {
        display: flex;
        opacity: 0.8;
    }

    .editor {
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 6px;
        min-width: 0;
    }

    .row {
        display: flex;
        gap: 5px;
    }
    .row :global(button) {
        flex: 1;
    }

    h4 {
        margin-top: 10px;
    }
    .tip {
        font-size: 0.8em;
        opacity: 0.6;
    }

    .chips {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        padding: 8px;
        border-radius: 6px;
        background-color: var(--primary-darker);
    }
    .sequence {
        min-height: 48px;
        border: 1px dashed transparent;
    }
    .sequence.dragging {
        border-color: var(--secondary);
    }

    .chip {
        display: flex;
        align-items: center;
        gap: 4px;
        padding: 5px 10px;
        border-radius: 14px;
        border: none;
        border-inline-start: 5px solid var(--color);
        background-color: var(--primary-lighter);
        color: var(--text);
        font: inherit;
        font-size: 0.9em;
        cursor: grab;
    }
    button.chip:hover:not(:disabled) {
        background-color: var(--hover);
    }
    .chip:disabled {
        cursor: default;
        opacity: 0.5;
    }
    .chip.dropBefore {
        box-shadow: -4px 0 0 var(--secondary);
    }
    .chip.disabledSlide span {
        opacity: 0.5;
        text-decoration: line-through;
    }

    .remove {
        display: flex;
        padding: 2px;
        border: none;
        border-radius: 50%;
        background: none;
        cursor: pointer;
        opacity: 0.7;
    }
    .remove:hover {
        opacity: 1;
        background-color: var(--hover);
    }

    .empty {
        opacity: 0.5;
        font-style: italic;
        font-size: 0.9em;
    }
</style>
