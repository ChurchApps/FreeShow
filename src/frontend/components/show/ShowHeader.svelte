<script lang="ts">
    import { fade } from "svelte/transition"
    import { uid } from "uid"
    import { Main } from "../../../types/IPC/Main"
    import { sendMain } from "../../IPC/main"
    import { activePopup, activeProject, activeShow, autoOpenedTimeline, editingProjectTemplate, focusMode, openToolsTab, outputs, projects, projectTemplates, selected, showNotesActive, shows, showsCache, special, styles, templates } from "../../stores"
    import { translateText } from "../../utils/language"
    import { getAccess } from "../../utils/profile"
    import { clone, keysToID, sortByName } from "../helpers/array"
    import { duplicate } from "../helpers/clipboard"
    import { history } from "../helpers/history"
    import Icon from "../helpers/Icon.svelte"
    import { allOutputsHasStyleTemplate, getFirstActiveOutput } from "../helpers/output"
    import { removeTemplatesFromShow } from "../helpers/show"
    import T from "../helpers/T.svelte"
    import MaterialButton from "../inputs/MaterialButton.svelte"
    import MaterialDropdown from "../inputs/MaterialDropdown.svelte"

    export let showId: string
    export let hideOptions = false
    export let projectIndex: number | undefined = undefined

    let profile = getAccess("shows")
    $: isLocked = currentShow?.locked || profile.global === "read" || profile[currentShow?.category || ""] === "read"

    $: currentShow = $showsCache[showId]
    $: layouts = currentShow?.layouts

    $: isTemplate = !!$editingProjectTemplate
    $: projectId = isTemplate ? $editingProjectTemplate : $activeProject
    $: store = isTemplate ? projectTemplates : projects
    $: project = $store[projectId!]

    let notes: { text: string; id: string; title: string; icon: string; tab: string } | null = null
    $: if (layouts || currentShow) updateNotes()
    function updateNotes() {
        notes = null

        const metadataValues = Object.values(currentShow.meta || {}).filter((a) => a !== currentShow?.name)
        const metadataText = metadataValues.reduce((v, a) => (v += a), "")
        if (metadataText.length) {
            const divider = "; "
            const text = metadataValues
                .filter((a) => a?.length)
                .join(divider)
                .replaceAll("<br>", " ")
            notes = { text: text, id: "metadata", title: "tools.metadata", icon: "info", tab: "metadata" }
            return
        }
    }

    const openTab = (e: Event, id: string) => {
        if (e.target?.closest("a")) {
            e.preventDefault()
            const url = (e.target as HTMLElement).closest("a")?.getAttribute("href") || ""
            sendMain(Main.URL, url)
            return
        }

        openToolsTab.set(id)
    }

    function mousedown(e) {
        if (!e.target.closest(".showDropdown") && !e.target.closest(".header .right")) showDropdown = false
    }

    let showDropdown = false
    let listScrollY = 0

    function toggleShowLock() {
        const shouldBeLocked = !currentShow?.locked

        showsCache.update((a) => {
            if (!a[showId]) return a
            a[showId].locked = shouldBeLocked

            removeTemplatesFromShow(showId)
            return a
        })
        shows.update((a) => {
            if (shouldBeLocked) a[showId].locked = true
            else delete a[showId].locked
            return a
        })
    }

    // LAYOUT

    $: projectLayout = $focusMode && projectIndex !== undefined ? project?.shows?.[projectIndex]?.layout : undefined
    $: activeLayout = projectLayout || currentShow?.settings?.activeLayout
    $: activeLayoutData = layouts?.[activeLayout] || Object.values(layouts || {})[0]

    $: sortedLayouts = sortByName(keysToID(layouts || {}))
    $: multipleLayouts = sortedLayouts.length > 1

    function setLayout(layoutId: string) {
        if (!$showsCache[showId]) return

        let layoutInfo: any = clone(sortedLayouts.find((layout) => layout.id === layoutId))
        if (layoutInfo?.id) delete layoutInfo.id

        showsCache.update((a) => {
            if (a[showId]) {
                if (!a[showId].settings) a[showId].settings = { activeLayout: "", template: null }
                a[showId].settings.activeLayout = layoutId
            }
            return a
        })

        // set active layout in project
        if (sortedLayouts?.length < 2) return
        const showIndex = projectIndex !== undefined ? projectIndex : $activeShow?.index
        if (($focusMode || $activeShow?.type === undefined || $activeShow?.type === "show") && showIndex !== undefined && projectId && project?.shows?.[showIndex]) {
            store.update((a) => {
                if (a[projectId!]?.shows?.[showIndex]) {
                    a[projectId!].shows[showIndex].layout = layoutId
                    a[projectId!].shows[showIndex].layoutInfo = layoutInfo
                }
                return a
            })
        }
    }

    function addLayout(e: any = null) {
        const layoutId = uid()
        const name = e === null ? "" : e.detail

        if (!name) {
            setTimeout(() => {
                selected.set({ id: "layout", data: [{ id: layoutId }] })
                activePopup.set("rename")
            })
        }

        const ctrlKey = false // e.detail.ctrl
        if (!ctrlKey) {
            duplicate({ id: "layout", data: [{ name, newId: layoutId }] })
            return
        }

        // create empty
        history({ id: "UPDATE", newData: { key: "layouts", subkey: layoutId }, oldData: { id: showId }, location: { page: "show", id: "show_layout" } })

        // set name
        showsCache.update((a) => {
            if (a[showId]?.layouts?.[layoutId]) {
                a[showId].layouts[layoutId] = { ...a[showId].layouts[layoutId], name }
            }
            return a
        })
    }

    $: layoutSlides = layouts?.[activeLayout]?.slides || []
    $: disabledLayouts = !layoutSlides.length || isLocked || !layoutSlides.some((a) => a && currentShow?.slides?.[a.id]?.group && currentShow?.slides?.[a.id]?.group !== ".")

    // TEMPLATE

    $: referenceType = currentShow?.reference?.type
    $: outputStyleId = getFirstActiveOutput($outputs)?.style || ""
    $: outputStyleTemplate = allOutputsHasStyleTemplate(referenceType === "scripture") ? $styles[outputStyleId]?.[referenceType === "scripture" ? "templateScripture" : "template"] || "" : ""
    $: enableStylePreview = !!(outputStyleTemplate && $special.styleTemplatePreview !== false && $templates[outputStyleTemplate])

    $: showTemplateId = currentShow?.settings?.template || ""
    $: showTemplateIcon = !!(showTemplateId && $templates[showTemplateId])
    $: enableShowTemplate = showTemplateIcon && (!referenceType || referenceType === "scripture" || open)
</script>

<svelte:window on:mousedown={mousedown} />

<div class="header context #default" class:shadow={listScrollY > 0} class:focusMode={$focusMode}>
    <div class="name-notes" data-title={currentShow?.name}>
        <div class="name">
            {#if $focusMode}
                <Icon id="slide" style="margin-right: 4px;" white />
            {/if}

            <span class="title">
                {#if currentShow?.name}
                    {currentShow.name}
                {:else}
                    <span style="opacity: 0.5;font-style: italic;"><T id="main.unnamed" /></span>
                {/if}
            </span>

            {#if multipleLayouts}
                <Icon id="next" style="opacity: 0.8;transform: translateY(2px);" size={1.2} white />

                {#if activeLayoutData}
                    <MaterialDropdown label="show.arrangement" options={sortedLayouts.map((layout) => ({ value: layout.id, label: layout.name }))} value={activeLayout} class="context #layout" on:change={(e) => setLayout(e.detail)} addNew={disabledLayouts ? "" : "show.new_arrangement"} on:new={addLayout} inline />
                {/if}
            {:else if !disabledLayouts && !$focusMode}
                <MaterialButton on:click={() => addLayout()} style="margin-left: 3px;padding: 3px 4px 2px 4px;" title="show.new_arrangement" center>
                    <Icon id="add" white />
                </MaterialButton>
            {/if}
        </div>

        {#if notes}
            <span class="notes" role="none" data-title={translateText(notes.title)} on:click={(e) => openTab(e, notes?.tab || "")}>
                <Icon id={notes.icon} size={0.8} right white />
                <p>{@html notes.text}</p>
            </span>
        {/if}
    </div>

    {#if !$focusMode}
        <div class="right">
            <!-- template icon -->
            {#if enableStylePreview}
                <MaterialButton style="width: 32px;height: 100%;padding: 0.3em 0.5em;" title="formats.template: <b>{$templates[outputStyleTemplate]?.name || ''}</b>" on:click={() => activePopup.set("template_info")}>
                    <Icon size={0.8} id="styles" white />
                </MaterialButton>
            {:else if enableShowTemplate}
                <MaterialButton style="width: 32px;height: 100%;padding: 0.3em 0.5em;" class="context #show_template" title="formats.template: <b>{$templates[showTemplateId]?.name || 'info.template'}</b>" on:click={() => activePopup.set("template_info")}>
                    <Icon size={0.8} id="templates" white />
                </MaterialButton>
            {/if}

            <!-- zoom icon ? -->
            <!-- <MaterialButton style="width: 32px;height: 100%;padding: 0.3em 0.5em;" title="actions.zoom" on:click={() => }>
            <Icon size={0.9} id="zoomIn" white />
        </MaterialButton> -->

            {#if !hideOptions}
                <!-- show more -->
                <MaterialButton style="width: 32px;height: 100%;padding: 0.3em 0.5em;border-bottom-right-radius: 10px;{showDropdown ? '' : 'opacity: 0.8;'}" title="create_show.more_options" icon="more" on:click={() => (showDropdown = !showDropdown)} white={!showDropdown}>
                    <!-- prevent force "white" -->
                    <span style="display: none;"></span>
                </MaterialButton>
            {/if}

            {#if showDropdown && currentShow}
                <div class="showDropdown" transition:fade={{ duration: 100 }} role="none" on:click={() => (showDropdown = false)}>
                    <MaterialButton title="tooltip.notes" on:click={() => showNotesActive.set(!$showNotesActive)}>
                        <Icon id="notes" white={!$showNotesActive} />

                        {#if $showNotesActive}
                            <Icon id="check" size={0.7} white />
                        {/if}

                        <p><T id="tools.notes" /></p>
                    </MaterialButton>

                    <div class="DIVIDER"></div>

                    <MaterialButton
                        title="timeline.toggle_timeline"
                        on:click={() => {
                            special.update((a) => ({ ...a, timelineActive: !a.timelineActive }))
                            autoOpenedTimeline.set(false)
                        }}
                    >
                        <Icon id="timeline" white={!$special.timelineActive} />

                        {#if $special.timelineActive}
                            <Icon id="check" size={0.7} white />
                        {/if}

                        <p><T id="timeline.toggle_timeline" /></p>
                    </MaterialButton>

                    <div class="DIVIDER"></div>

                    <MaterialButton title="context.lockForChanges" on:click={toggleShowLock}>
                        <Icon id="lock" white={!currentShow.locked} />

                        {#if currentShow.locked}
                            <Icon id="check" size={0.7} white />
                        {/if}

                        <p><T id="context.lockForChanges" /></p>
                    </MaterialButton>
                </div>
            {/if}
        </div>
    {/if}
</div>

<style>
    /* header */

    .header {
        position: sticky;
        top: 0;
        left: 0;
        width: 100%;

        padding: 0.2em;
        padding-left: 0.8em;
        font-weight: 600;

        height: 30px;

        display: flex;
        align-items: center;

        backdrop-filter: blur(10px);

        border-bottom-left-radius: 10px;
        border-bottom-right-radius: 10px;

        background-color: rgb(0 0 10 / 0.3);

        z-index: 200;
        transition: box-shadow 0.2s ease;
    }
    .header.shadow {
        background-color: rgb(0 0 10 / 0.12);
        box-shadow: 0 2px 4px rgb(0 0 10 / 0.3);
    }

    .header.focusMode:not(.shadow) {
        border-radius: 0;
    }

    .header .right {
        height: 100%;

        display: flex;
        flex-shrink: 0;
        margin-left: auto;
    }

    /* name and notes */

    .name {
        display: flex;
        align-items: center;
        gap: 1px;
    }

    .name-notes {
        flex: 1;
        display: flex;
        align-items: center;
        gap: 0.5em;
        font-size: 0.9em;
        min-width: 0;
    }

    .name-notes .name {
        display: flex;
        align-items: center;
        gap: 1px;
        flex-shrink: 0;
        max-width: 90%;
        min-width: 0;
    }

    .name-notes .title {
        display: inline-block;
        max-width: 100%;
        min-width: 0;

        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    /* notes */

    .notes {
        padding: 0 8px;
        min-height: 30px;

        display: flex;
        align-items: center;
        justify-content: start;

        opacity: 0.7;
        font-size: 0.7em;
        font-weight: normal;
        flex: 1;
        min-width: 0;
    }

    .notes p {
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .notes p :global(*) {
        display: inline;
    }

    .notes :global(a) {
        color: var(--text);
        opacity: 0.7;

        display: inline-flex;
        gap: 5px;
        align-items: flex-end;

        -webkit-user-drag: none;
    }
    .notes :global(a:hover) {
        opacity: 0.75;
    }
    .notes :global(a:active) {
        opacity: 0.9;
    }

    /* dropdown */

    .showDropdown {
        position: absolute;
        top: 31px;
        right: 5px;
        overflow: hidden;

        display: flex;
        flex-direction: column;
        align-items: flex-start;

        /* backdrop-filter: blur(10px);
        background-color: rgb(0 0 10 / 0.3); */

        background-color: var(--primary-darkest);
        border-radius: 6px;

        border: 1px solid var(--primary-lighter);

        z-index: 1;
        box-shadow: 0 2px 5px rgb(0 0 0 / 0.3);
    }

    .showDropdown :global(button) {
        width: 100%;
        justify-content: start;
        padding: 8px 12px;
        border-radius: 0;

        font-weight: normal;
        font-size: 0.9em;
    }

    .showDropdown .DIVIDER {
        width: 100%;
        height: 1px;
        background-color: var(--primary-lighter);
    }
</style>
