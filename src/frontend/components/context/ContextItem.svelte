<script lang="ts">
    import { activeProject, activeRecording, activeShow, events, forceClock, media, overlays, redoHistory, scriptures, selected, shows, stageShows, undoHistory } from "../../stores"
    import { GetLayout } from "../helpers/get"
    import Icon from "../helpers/Icon.svelte"
    import { _show } from "../helpers/shows"
    import T from "../helpers/T.svelte"
    import { ContextMenuItem, contextMenuItems } from "./contextMenus"
    import { menuClick } from "./menuClick"

    export let contextElem: any = null
    export let contextActive: boolean
    export let id: string
    export let menu: ContextMenuItem = contextMenuItems[id]
    export let disabled: boolean = false
    let enabled: boolean = menu?.enabled ? true : false

    const conditions: any = {
        private: () => {
            if ($shows[$selected.data[0]?.id]?.private) enabled = $shows[$selected.data[0].id].private!
        },
        disable: () => {
            if ($selected.id === "slide" && $activeShow) {
                enabled = GetLayout()[$selected.data[0].index].disabled! || false
            } else if ($selected.id === "group") {
                enabled = GetLayout().find((a) => a.id === $selected.data[0].id)?.disabled!
            } else if ($selected.id === "stage") {
                enabled = $stageShows[$selected.data[0].id]?.disabled
            }

            menu.label = enabled ? "actions.enable" : "actions.disable"
        },
        remove_group: () => {
            if ($selected.id !== "slide") return

            let ref = _show().layouts("active").ref()[0]
            let parentSlide = $selected.data.find((a) => a.index && getCurrentSlide(a.index)?.type === "parent")
            function getCurrentSlide(index) {
                return ref.find((a) => a.layoutIndex === index)
            }

            if (parentSlide) return

            // disable when no parents are selected or just first slide
            disabled = true
        },
        remove: () => {
            if ($selected.id === "show" && _show($selected.data[0].id).get("private") === true) disabled = true
        },
        undo: () => {
            if (!$undoHistory.length) disabled = true
        },
        redo: () => {
            if (!$redoHistory.length) disabled = true
        },
        addToProject: () => {
            if (!$activeProject) disabled = true
        },
        play_no_filters: () => {
            let path = $selected.data[0]?.path || $selected.data[0]?.id
            if (!path || !$media[path]?.filter) disabled = true
        },
        delete_all: () => {
            if (contextElem?.classList.value.includes("#event")) {
                let group: any = $events[contextElem.id].group
                if (!group || !Object.entries($events).find(([id, event]: any) => id !== contextElem.id && event.group === group)) disabled = true
            }
        },
        createCollection: () => {
            if ($scriptures[$selected.data[0]]?.collection) disabled = true
        },
        favourite: () => {
            let path = $selected.data[0]?.path || $selected.data[0]?.id
            if (path && $media[path]?.favourite === true) enabled = true
        },
        lock_to_output: () => {
            let id = $selected.data[0]
            if ($overlays[id]?.locked) enabled = true
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
    }
    if (conditions[id]) conditions[id]()

    // if (id === "private" && $showsCache[$selected.data[0]?.id]?.private) {
    //   enabled = $showsCache[$selected.data[0].id].private!
    // } else if (id === "disable") {
    //   if ($selected.id === "slide" && $activeShow && GetLayout()[$selected.data[0]?.index]?.disabled) {
    //     enabled = GetLayout()[$selected.data[0].index].disabled!
    //   } else if ($selected.id === "group") {
    //     enabled = GetLayout().find((a) => a.id === $selected.data[0].id)?.disabled!
    //   }
    // } else if (id === "remove" && $selected.id === "slide") {
    //   if ($selected.data.filter((a) => a.index === 0).length || GetLayoutRef()[$selected.data[0].index].type === "child") disabled = true
    // } else if (id === "undo" && !$undoHistory.length) disabled = true
    // else if (id === "redo" && !$redoHistory.length) disabled = true

    function contextItemClick() {
        if (disabled) return

        let actionItem: null | HTMLElement = contextElem?.classList.contains("_" + id) ? contextElem : contextElem?.querySelector("._" + id)
        let sel: any = $selected

        let m: any = menuClick(id, enabled, menu, contextElem, actionItem, sel)
        if (m?.enabled !== undefined) enabled = m.enabled
        if (!m || m.hide) contextActive = false
    }

    function keydown(e: any) {
        if (e.key === "Enter") contextItemClick()
    }
</script>

<!-- {$fullColors ? 'background-' : ''} -->
<!-- title={menu?.shortcuts?.join(", ")} -->
<div on:click={contextItemClick} class:enabled class:disabled style="color: {menu?.color || 'unset'}" tabindex={0} on:keydown={keydown}>
    <span style="display: flex;align-items: center;gap: 10px;">
        {#if menu?.icon}<Icon id={menu.icon} />{/if}
        {#if menu?.translate === false}
            <p>{menu?.label}</p>
        {:else}
            {#key menu}
                <p><T id={menu?.label || id} /></p>
            {/key}
        {/if}
    </span>
    {#if menu?.shortcuts}
        <span style="opacity: 0.5;">
            {menu.shortcuts[0]}
        </span>
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
</style>
