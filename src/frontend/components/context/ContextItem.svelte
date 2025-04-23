<script lang="ts">
    import {
        activeEdit,
        activeProject,
        activeRecording,
        activeShow,
        categories,
        effectsLibrary,
        events,
        forceClock,
        media,
        midiIn,
        os,
        outputs,
        overlayCategories,
        overlays,
        redoHistory,
        scriptures,
        selected,
        shows,
        showsCache,
        slidesOptions,
        stageShows,
        templateCategories,
        timers,
        topContextActive,
        undoHistory,
    } from "../../stores"
    import { closeContextMenu } from "../../utils/shortcuts"
    import { keysToID } from "../helpers/array"
    import Icon from "../helpers/Icon.svelte"
    import { getExtension, getMediaType } from "../helpers/media"
    import { getLayoutRef } from "../helpers/show"
    import { _show } from "../helpers/shows"
    import T from "../helpers/T.svelte"
    import { type ContextMenuItem, contextMenuItems } from "./contextMenus"
    import { menuClick } from "./menuClick"

    export let contextElem: HTMLDivElement | null = null
    export let topBar: boolean = false
    export let id: string
    export let menu: ContextMenuItem = contextMenuItems[id]
    export let disabled: boolean = false

    let hide: boolean = false
    let enabled: boolean = menu?.enabled ? true : false

    const conditions = {
        // slide views
        view_grid: () => ($slidesOptions.mode === "grid" ? (enabled = true) : ""),
        view_simple: () => ($slidesOptions.mode === "simple" ? (enabled = true) : ""),
        view_list: () => ($slidesOptions.mode === "list" ? (enabled = true) : ""),
        view_lyrics: () => ($slidesOptions.mode === "lyrics" ? (enabled = true) : ""),
        rename: () => {
            hide = !!$shows[$selected.data[0]?.id]?.locked
        },
        delete: () => {
            hide = !!$shows[$selected.data[0]?.id]?.locked
        },
        private: () => {
            let show = $shows[$selected.data[0]?.id]
            if (!show) return

            enabled = !!show.private
            hide = !!(!enabled && show.locked)
        },
        use_as_archive: () => {
            const categoryStores = {
                category_shows: () => $categories,
                category_overlays: () => $overlayCategories,
                category_templates: () => $templateCategories,
            }

            const isArchive = !!categoryStores[$selected.id || ""]?.()[$selected.data[0]]?.isArchive
            enabled = isArchive
        },
        lock_show: () => {
            if (!$shows[$selected.data[0]?.id]?.locked) return
            enabled = !!$shows[$selected.data[0].id].locked
        },
        disable: () => {
            if ($selected.id === "slide" && $activeShow) {
                let ref = getLayoutRef()
                enabled = ref[$selected.data[0]?.index]?.data?.disabled || false
            } else if ($selected.id === "stage") {
                enabled = $stageShows[$selected.data[0]?.id]?.disabled
            } else if ($selected.id === "action") {
                let action = $midiIn[$selected.data[0]?.id] || {}
                if (!action.customActivation) disabled = true
                else enabled = action.enabled === false
            }

            menu.label = enabled ? "actions.enable" : "actions.disable"
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
        createCollection: () => {
            let selectedBibles = $selected.data.map((id) => $scriptures[id]).filter((a) => !a?.collection)
            if (selectedBibles.length < 2) disabled = true
        },
        favourite: () => {
            let path = $selected.data[0]?.path || $selected.data[0]?.id
            if (path && $media[path]?.favourite === true) enabled = true
        },
        effects_library_add: () => {
            // WIP don't show this if not an effect
            let path = $selected.data[0]?.path || $selected.data[0]?.id
            let existing = $effectsLibrary.find((a) => a.path === path)
            if (path && existing) enabled = true
            menu.label = enabled ? "media.effects_library_remove" : "media.effects_library_add"
        },
        lock_to_output: () => {
            let id = $selected.data[0]
            if ($overlays[id]?.displayDuration) disabled = true
            else if ($overlays[id]?.locked) enabled = true
        },
        display_duration: () => {
            let id = $selected.data[0]
            if ($overlays[id]?.locked) disabled = true
            else if ($overlays[id]?.displayDuration) enabled = true
        },
        move_to_front: () => {
            let previewOutputs = keysToID($outputs).filter((a) => a.enabled && !a.isKeyOutput)
            // WIP check currently selected against the other outputs...
            if (previewOutputs.length !== 2) {
                disabled = false
                return
            }

            const alwaysOnTopState = [...new Set(previewOutputs.map((out) => out?.alwaysOnTop ?? true))]

            // disable if all outputs have different states!
            disabled = alwaysOnTopState.length === previewOutputs.length
        },
        hide_from_preview: () => {
            let outputId = contextElem?.id || ""
            if ($outputs[outputId]?.hideFromPreview) enabled = true
            menu.label = enabled ? "context.enable_preview" : "context.hide_from_preview"
        },
        place_under_slide: () => {
            let id = $selected.data[0]
            if ($overlays[id]?.placeUnderSlide) enabled = true
        },
        toggle_clock: () => {
            if ($forceClock) enabled = true
        },
        recording: () => {
            if ($activeRecording) {
                menu.label = "actions.stop_recording"
                menu.icon = "stop"
                enabled = true
            } else {
                menu.label = "actions.start_recording"
                menu.icon = "record"
            }
        },
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
        const keepOpenToggle = ["enabled_drawer_tabs", "tag_set", "tag_filter", "media_tag_set", "media_tag_filter", "action_tag_set", "action_tag_filter", "bind_slide", "bind_item"]
        if (keepOpenToggle.includes(id)) {
            enabled = !enabled
            return
        }

        if (topBar) topContextActive.set(false)
        else closeContextMenu()
    }

    function keydown(e: KeyboardEvent) {
        if (e.key === "Enter") contextItemClick()
    }

    let shortcut: string = ""
    $: if (menu?.shortcuts) getShortcuts()
    function getShortcuts() {
        // WIP multiple
        let s = menu.shortcuts![0]
        if ($os.platform === "darwin") s.replaceAll("Ctrl", "Cmd")
        shortcut = s
    }

    $: customStyle = id === "uppercase" ? "text-transform: uppercase;" : id === "lowercase" ? "text-transform: lowercase;" : ""
</script>

<div on:click={contextItemClick} class:enabled class:disabled class:hide style="color: {menu?.color || 'unset'};font-weight: {menu?.color ? '500' : 'normal'};" tabindex={0} on:keydown={keydown}>
    <span style="display: flex;align-items: center;gap: 10px;">
        {#if menu?.icon}<Icon id={menu.icon} />{/if}
        <p style="display: flex;align-items: center;gap: 5px;{customStyle}">
            {#if menu?.translate === false}
                {#if menu?.label}
                    {menu.label}
                {:else}
                    <span style="opacity: 0.5;font-style: italic;pointer-events: none;"><T id="main.unnamed" /></span>
                {/if}
            {:else}
                {#key menu}
                    <T id={menu?.label || id} />
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
        padding: 5px 20px;
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
        background-color: rgb(255 255 255 / 0.1);
    }

    .hide {
        display: none;
    }
</style>
