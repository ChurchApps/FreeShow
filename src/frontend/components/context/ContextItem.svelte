<script lang="ts">
    import { cameraManager } from "../../media/cameraManager"
    import {
        actions,
        activeEdit,
        activeProject,
        activeRecording,
        activeShow,
        categories,
        colorbars,
        dictionary,
        disabledServers,
        drawerTabsData,
        effects,
        effectsLibrary,
        events,
        forceClock,
        livePrepare,
        media,
        os,
        outputs,
        overlayCategories,
        overlays,
        projects,
        redoHistory,
        scriptures,
        selected,
        shows,
        showsCache,
        slidesOptions,
        stageShows,
        styles,
        templateCategories,
        timers,
        topContextActive,
        undoHistory
    } from "../../stores"
    import { translateText } from "../../utils/language"
    import { closeContextMenu } from "../../utils/shortcuts"
    import { keysToID } from "../helpers/array"
    import Icon from "../helpers/Icon.svelte"
    import { getExtension, getMediaType } from "../helpers/media"
    import { getLayoutRef } from "../helpers/show"
    import { _show } from "../helpers/shows"
    import T from "../helpers/T.svelte"
    import { ContextMenuItem, contextMenuItems } from "./contextMenus"
    import { menuClick } from "./menuClick"

    export let contextElem: HTMLDivElement | null = null
    export let topBar = false
    export let id: string
    export let menu: ContextMenuItem = contextMenuItems[id]
    export let disabled = false

    let hide = false
    let enabled: boolean = menu?.enabled ? true : false

    const conditions = {
        // slide views
        view_grid: () => ($slidesOptions.mode === "grid" ? (enabled = true) : ""),
        view_simple: () => ($slidesOptions.mode === "simple" ? (enabled = true) : ""),
        view_groups: () => ($slidesOptions.mode === "groups" ? (enabled = true) : ""),
        view_list: () => ($slidesOptions.mode === "list" ? (enabled = true) : ""),
        view_lyrics: () => ($slidesOptions.mode === "lyrics" ? (enabled = true) : ""),
        rename: () => {
            disabled = !!$shows[$selected.data[0]?.id]?.locked // hide
        },
        delete: () => {
            hide = !!$shows[$selected.data[0]?.id]?.locked
        },
        private: () => {
            let show = $shows[$selected.data[0]?.id]
            if (!show) return

            enabled = !!show.private
            disabled = !!(!enabled && show.locked) // hide
        },
        use_as_archive: () => {
            const categoryStores = {
                category_shows: () => $categories,
                category_overlays: () => $overlayCategories,
                category_templates: () => $templateCategories
            }

            const isArchive = !!categoryStores[$selected.id || ""]?.()[$selected.data[0]]?.isArchive
            enabled = isArchive
        },
        archive: () => {
            const projectId = $selected.data?.[0]?.id
            let project = $projects[projectId]
            enabled = !!project.archived
        },
        edit: () => {
            if ($selected.id !== "show_drawer" || !$shows[$selected.data[0]?.id]?.locked) return
            disabled = !!$shows[$selected.data[0].id].locked
        },
        edit_style: () => {
            let outputId = contextElem?.id || ""
            const styleId = $outputs[outputId]?.style || ""
            const stageId = $outputs[outputId]?.stageOutput || ""

            if (stageId) {
                menu.label = "stage.stage_layout"
                menu.icon = "stage"
                if (!$stageShows[stageId]) disabled = true
                menu.label += `: ${stageId ? $stageShows[stageId]?.name || "error.not_found" : "main.none"}`
                return
            }

            menu.label = "edit.style"
            menu.icon = "styles"
            if (!$styles[styleId]) disabled = true
            menu.label += `: ${styleId ? $styles[styleId]?.name || "error.not_found" : "main.none"}`
        },
        lock_show: () => {
            if (!$shows[$selected.data[0]?.id]?.locked) return
            enabled = !!$shows[$selected.data[0].id].locked
        },
        disable: () => {
            let isEnabled = false
            if ($selected.id === "slide" && $activeShow) {
                let ref = getLayoutRef()
                isEnabled = ref[$selected.data[0]?.index]?.data?.disabled || false
            } else if ($selected.id === "stage") {
                isEnabled = $stageShows[$selected.data[0]?.id]?.disabled
            } else if ($selected.id === "action") {
                let action = $actions[$selected.data[0]?.id] || {}
                if (!action.customActivation) hide = true
                else isEnabled = action.enabled === false
            }

            enabled = isEnabled
            menu.label = isEnabled ? "actions.enable" : "actions.disable"
        },
        move_connections: () => {
            hide = $disabledServers.stage === true
        },
        slide_transition: () => {
            if ($selected.id === "slide" && $activeShow) {
                let ref = getLayoutRef()
                enabled = !!(ref[$selected.data[0]?.index]?.data?.transition || false)
            }
        },
        transition: () => {
            if ($activeShow && $showsCache[$activeShow.id] && $activeEdit.items.length) {
                let ref = getLayoutRef()
                let slideId = ref[$activeEdit.slide || 0]?.id
                let item = $showsCache[$activeShow.id].slides?.[slideId]?.items?.[$activeEdit.items[0]] || {}
                enabled = item.actions?.transition
                console.log(item)
                // console.log($activeShow, $activeEdit)

                // $showsCache[$activeShow.id].slides?.[$activeEdit.]?.
                // let ref = getLayoutRef()
                // enabled = ref[$selected.data[0]?.index]?.data?.transition || false
            }
        },
        remove_group: () => {
            if ($selected.id !== "slide") return

            let ref = getLayoutRef()
            const getCurrentSlide = (index) => ref.find((a) => a.layoutIndex === index)
            let parentSlide = $selected.data.find((a) => a.index && getCurrentSlide(a.index)?.type === "parent")

            if (parentSlide) return

            // disable when no parents are selected or just first slide
            disabled = true
        },
        remove: () => {
            if ($selected.id !== "show" || _show($selected.data[0]?.id).get("private") !== true) return
            disabled = true
        },
        undo: () => {
            if (!$undoHistory.length) disabled = true
        },
        redo: () => {
            if (!$redoHistory.length) disabled = true
        },
        addToProject: () => {
            // hide button if $selected.id === "media" && one item selected ? as it's now done with double click
            if ($selected.id === "media" && $selected.data.length > 1) {
                id = "createSlideshow"
                menu = { label: "context.create_slideshow", icon: "slide" }
                // id = "addToShow"
                // menu = { label: "context.add_to_show", icon: "slide" }
                // if (!$activeShow || ($activeShow.type || "show") !== "show") disabled = true
            } else {
                if (!$activeProject) disabled = true
            }
        },
        play: () => {
            if ($selected.id === "global_timer") {
                let timer = $timers[$selected.data[0]?.id]
                if (timer?.type !== "counter") disabled = true
            }
        },
        play_no_audio: () => {
            let path = $selected.data[0]?.path || $selected.data[0]?.id
            const type = getMediaType(getExtension(path))
            if (type !== "video") hide = true
        },
        play_no_filters: () => {
            let path = $selected.data[0]?.path || $selected.data[0]?.id
            if (!path || !$media[path]?.filter) disabled = true
        },
        delete_all: () => {
            if (!contextElem?.classList.value.includes("#event")) return

            let group = $events[contextElem.id].group
            if (group && Object.entries($events).find(([id, event]) => id !== contextElem.id && event.group === group)) return

            disabled = true
        },
        favourite: () => {
            if ($selected.id?.includes("category_scripture")) {
                let id = $selected.data[0]
                enabled = !!$scriptures[id]?.favorite
            } else {
                let path = $selected.data[0]?.path || $selected.data[0]?.id
                enabled = !!$media[path]?.favourite
            }
        },
        effects_library_add: () => {
            // WIP don't show this if not an effect
            let isEnabled = false
            let path = $selected.data[0]?.path || $selected.data[0]?.id
            let existing = $effectsLibrary.find((a) => a.path === path)
            if (path && existing) isEnabled = true

            enabled = isEnabled
            menu.label = isEnabled ? "media.effects_library_remove" : "media.effects_library_add"
        },
        startup_activate: () => {
            const startupCameras = cameraManager.getStartupCameras()
            const camId = $selected.data[0]?.id
            enabled = camId && startupCameras.includes(camId)
        },
        lock_to_output: () => {
            let id = $selected.data[0]
            if ($overlays[id]?.displayDuration) disabled = true
            else if ($overlays[id]?.locked) enabled = true
        },
        display_duration: () => {
            const subTab = $drawerTabsData.overlays?.activeSubTab
            let id = $selected.data[0]
            if (subTab === "effects") {
                if ($effects[id]?.displayDuration) enabled = true
            } else {
                if ($overlays[id]?.locked) disabled = true
                else if ($overlays[id]?.displayDuration) enabled = true
            }
        },
        toggle_output: () => {
            let outputId = contextElem?.id || ""
            disabled = !!$outputs[outputId]?.invisible
        },
        move_to_front: () => {
            let previewOutputs = keysToID($outputs).filter((a) => a.enabled) //  && !a.invisible
            // WIP check currently selected against the other outputs...
            if (previewOutputs.length !== 2) {
                disabled = false
                return
            }

            let outputId = contextElem?.id || ""
            if ($outputs[outputId]?.invisible) {
                disabled = true
                return
            }

            const alwaysOnTopState = [...new Set(previewOutputs.map((out) => out?.alwaysOnTop ?? true))]

            // disable if all outputs have different states!
            disabled = alwaysOnTopState.length === previewOutputs.length
        },
        hide_from_preview: () => {
            let isEnabled = false
            let outputId = contextElem?.id || ""
            if ($outputs[outputId]?.hideFromPreview) isEnabled = true

            enabled = isEnabled
            menu.label = isEnabled ? "context.enable_preview" : "context.hide_from_preview"
        },
        test_pattern: () => {
            const outputId = contextElem?.id || ""
            enabled = !!$colorbars[outputId]
        },
        live_prepare: () => {
            const outputId = contextElem?.id || ""
            enabled = !!$livePrepare[outputId]
        },
        place_under_slide: () => {
            let id = $selected.data[0]
            if ($overlays[id]?.placeUnderSlide || $effects[id]?.placeUnderSlide) enabled = true
        },
        toggle_clock: () => {
            if ($forceClock) enabled = true
        },
        recording: () => {
            if ($activeRecording) {
                menu.label = "actions.stop_recording"
                menu.icon = "stop"
                // enabled = true
            } else {
                menu.label = "actions.start_recording"
                menu.icon = "record"
            }
        },
        mark_played: () => {
            const projectId = $activeProject
            const index = $selected.data[0]?.index
            if (!projectId || index === undefined) return

            const show = $projects[projectId]?.shows?.[index]
            const isPlayed = !!show?.played

            menu.label = `actions.mark_${isPlayed ? "not_" : ""}played`
            menu.icon = isPlayed ? "remove" : "check"
            menu.iconColor = isPlayed ? "var(--secondary)" : "var(--text)"
            enabled = isPlayed
        }
        // bind_item: () => {
        //     if (item is bound) enabled = true
        // }
    }

    if (conditions[id]) conditions[id]()

    function contextItemClick() {
        if (disabled) return

        let actionItem: HTMLElement | null = contextElem?.classList.contains("_" + id) ? contextElem : contextElem?.querySelector("._" + id) || null
        let sel = $selected

        menuClick(id, enabled, menu, contextElem, actionItem, sel)

        // don't hide context menu
        const keepOpen = ["uppercase", "lowercase", "capitalize", "trim"] // "dynamic_values" (caret position is lost)
        if (keepOpen.includes(id)) return
        const keepOpenToggle = ["enabled_drawer_tabs", "tag_set", "tag_filter", "media_tag_set", "media_tag_filter", "action_tag_set", "action_tag_filter", "variable_tag_set", "variable_tag_filter", "bind_slide", "bind_item"]
        if (keepOpenToggle.includes(id)) {
            enabled = !enabled
            return
        }

        if (topBar) topContextActive.set(false)
        else closeContextMenu()
    }

    function keydown(e: KeyboardEvent) {
        if (e.key === "Enter" || e.key === " ") {
            e.preventDefault()
            contextItemClick()
        }
    }

    let shortcut = ""
    $: if (menu?.shortcuts) getShortcuts()
    function getShortcuts() {
        // WIP multiple
        let s = menu.shortcuts![0]
        if ($os.platform === "darwin") s = s.replaceAll("Ctrl", "Cmd") // .replaceAll("Alt", "Option")
        shortcut = s
    }

    $: customStyle = id === "uppercase" ? "text-transform: uppercase;" : id === "lowercase" ? "text-transform: lowercase;" : ""
</script>

<div on:click={contextItemClick} class:enabled class:disabled class:hide style="color: {menu?.color || 'unset'};font-weight: {menu?.color ? '500' : 'normal'};{menu?.style || ''}" tabindex={0} on:keydown={keydown} role="menuitem">
    <span style="display: flex;align-items: center;gap: 15px;">
        <!-- white={menu.icon !== "edit"} -->
        {#if menu?.icon}<Icon style="opacity: 0.7;color: {(topBar ? '' : menu.iconColor) || 'var(--text)'};" id={menu.icon} white />{/if}
        {#if enabled === true}<Icon id="check" style="fill: var(--text);" size={0.7} white />{/if}
        <p style="display: flex;align-items: center;gap: 5px;{customStyle}">
            {#if menu?.translate === false}
                {#if menu?.label}
                    {menu.label}
                {:else}
                    <span style="opacity: 0.5;font-style: italic;pointer-events: none;"><T id="main.unnamed" /></span>
                {/if}
            {:else}
                {#key menu}
                    <!-- <T id={menu?.label || id} /> -->
                    {translateText(menu?.label || id, $dictionary)}
                {/key}
            {/if}
            {#if menu?.external}
                <Icon id="launch" style="opacity: 0.8;" white />
            {/if}
        </p>
    </span>

    {#if shortcut}
        <span style="opacity: 0.4;font-size: 0.8em;/*text-transform: uppercase;*/">{shortcut}</span>
    {/if}
</div>

<style>
    div {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        padding: 6px 16px;
        cursor: pointer;
    }
    div:hover:not(.disabled) {
        background-color: rgb(0 0 0 / 0.2);
    }

    div.disabled {
        opacity: 0.5;
        cursor: default;
    }

    p {
        max-width: 300px;
    }

    .enabled {
        color: var(--secondary);
        background-color: rgb(255 255 255 / 0.05);
    }

    .hide {
        display: none;
    }
</style>
