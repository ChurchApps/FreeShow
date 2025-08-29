<script lang="ts">
    import { uid } from "uid"
    import type { SelectIds } from "../../../types/Main"
    import type { Media, Slide } from "../../../types/Show"
    import { activeDropId, activeRename, activeShow, disableDragging, os, selected, drawerTabsData, scriptures } from "../../stores"
    import { arrayHasData, clone } from "../helpers/array"
    import { _show } from "../helpers/shows"
    import { getLayoutRef } from "../helpers/show"

    export let id: SelectIds
    export let data: any
    export let fill = false
    export let draggable = false
    export let shiftRange: any[] = []
    export let onlyRightClickSelect = false
    export let selectable = true
    export let trigger: null | "row" | "column" = null
    export let fileOver = false
    export let borders: "all" | "center" | "edges" = "all"
    export let triggerOnHover = false
    export let dropAbove = false
    let elem: HTMLElement | undefined

    function enter(e: any) {
        if (!selectable || $selected.hoverActive) return
        // Only allow left-click (button 1) for drag selection
        if (!e.buttons || e.buttons !== 1 || dragActive || onlyRightClickSelect) return

        if ((id === "project" || id === "folder") && $selected.data[0] && data.index < $selected.data[0].index) {
            selected.set({ id, data: [data] })
            return
        }

        if ($selected.id !== id) selected.set({ id, data: [data] })
        else if (!arrayHasData($selected.data, data)) {
            selected.update((s) => {
                s.data = [...s.data, data]
                return s
            })
        }
    }

    const TRIGGER_TIMEOUT = 500
    let triggerTimeout: ReturnType<typeof setTimeout> | null = null
    function triggerHoverAction() {
        if (!triggerOnHover || triggerTimeout) return

        triggerTimeout = setTimeout(() => {
            triggerTimeout = null
            if (!dragover) return
            if (!triggerHoverActions[id]) return console.log("MISSING HOVER TRIGGER:", id)

            triggerHoverActions[id]()
        }, TRIGGER_TIMEOUT)
    }

    const triggerHoverActions = {
        show: () => {
            if (($selected.id === "slide" || $selected.id === "group" || $selected.id === "global_group") && (data.type || "show") === "show") {
                // copy slide data
                if (($selected.id === "slide" || $selected.id === "group") && !$selected.hoverActive) {
                    let slides = convertDataToSlide(clone($selected.data))
                    selected.set({ ...$selected, hoverActive: true })

                    // select after show is opened (because a slide is selected in the new show)
                    setTimeout(() => {
                        selected.set({ id: "global_group", data: slides, hoverActive: true })
                    }, 50)
                }

                // open show
                activeShow.set(data)
            }
        }
    }

    function convertDataToSlide(slideRef: { index?: number; id?: string }[]) {
        let currentSlides: { [key: string]: Slide } = _show().get("slides")
        let currentMedia: Media = _show().get("media") || {}
        let currentLayoutRef = getLayoutRef()

        let slideData = slideRef.map(({ index, id }) => {
            let layout
            if (id) layout = currentLayoutRef.find((a) => a.id === id) || {}
            else if (index !== undefined) layout = currentLayoutRef[index] || {}

            let layoutMedia: { [key: string]: Media } = {}
            if (layout.data?.background) layoutMedia[layout.data.background] = currentMedia[layout.data?.background]
            if (layout.data?.audio) {
                layout.data.audio.forEach((audioId) => {
                    layoutMedia[audioId] = currentMedia[audioId]
                })
            }

            return { slide: clone(currentSlides[layout.id]), layoutData: layout.data, media: layoutMedia }
        })

        return slideData.filter((a) => a.slide)
    }

    // TOUCH SCREEN: synthesize a minimal mouse-like event and reuse mousedown logic
    // did not work at the moment
    // on:touchstart={touchstart}
    // function touchstart(e: TouchEvent) {
    //     const fakeMouseEvent: any = {
    //         button: 0,
    //         buttons: 1,
    //         shiftKey: false,
    //         ctrlKey: false,
    //         metaKey: false,
    //         // keep the original target so remainSelected/deselect logic still works
    //         target: (e as any).target || undefined
    //     }

    //     mousedown(fakeMouseEvent, false)
    // }

    function touchend(e: TouchEvent) {
        endDrag()
        deselect(e)
    }

    // DRAG EVENT

    function mousedown(e: any, dragged = false) {
        if (!selectable) return
        if (dragged && ($activeRename !== null || $disableDragging)) return e.preventDefault()

        if ($selected.id !== id) {
            if (remainSelected(e, dragged)) return
            selected.set({ id, data: [] })
        }

        // this affects the cursor
        // https://developer.mozilla.org/en-US/docs/Web/API/DataTransfer/dropEffect
        let type: "copy" | "move" | "link" = "move"
        if (e.dataTransfer) e.dataTransfer.effectAllowed = type
        // e.dataTransfer.dropEffect = type
        // e.dataTransfer.setData("text", data)

        // TODO: !$renameActive
        // if (id === "folder" && $selected.data[0]?.id === "folder" && data.index < $selected.data[0].index) return
        // if (id === "folder" && ($selected.data[0]?.id === "project" || data.index > $selected.data[0]?.index)) return

        let newData: any
        const rightClick: boolean = e.button === 2 || e.buttons === 2 || ($os.platform === "darwin" && e.ctrlKey)

        if (onlyRightClickSelect) {
            if (rightClick) selected.set({ id, data: [data] })
            return
        }

        // shift select range
        if (e.shiftKey && (shiftRange.length || $selected.data[0]?.index !== undefined)) {
            const searchKeys = ["id", "index", "path"]
            let lastSelected = $selected.data[$selected.data.length - 1]
            if (!lastSelected) return

            let lastSelectedIndex: number = shiftRange.length ? shiftRange.findLastIndex((a) => searchKeys.find((key) => lastSelected[key] !== undefined && lastSelected[key] === a[key])) : lastSelected.index || 0
            let newIndex: number = shiftRange.length ? shiftRange.findIndex((a) => searchKeys.find((key) => data[key] !== undefined && data[key] === a[key])) : data.index || 0
            let lowestNumber = Math.min(lastSelectedIndex, newIndex) + 1
            let highestNumber = Math.max(lastSelectedIndex, newIndex) - 1

            let selectedBetween: number[] = range(lowestNumber, highestNumber)
            function range(start: number, end: number) {
                return Array(end - start + 1)
                    .fill("")
                    .map((_, idx) => start + idx)
            }

            let dataBetween = selectedBetween.map((index) => (shiftRange.length ? shiftRange[index] : { index }))
            let allNewData = [...$selected.data, ...dataBetween, data]

            let keys = Object.keys(data)
            // add all previous keys to new data
            if (shiftRange) {
                allNewData = allNewData
                    .map((data) => {
                        let newData: any = {}
                        keys.forEach((key) => {
                            newData[key] = data[key]
                        })
                        return newData
                    })
                    .filter((a) => a)
            }

            // remove duplicates
            let alreadyAdded: string[] = []
            newData = allNewData.filter((data) => {
                let dataString = JSON.stringify(data)
                if (alreadyAdded.find((a) => JSON.stringify(a) === dataString)) return false

                alreadyAdded.push(dataString)
                return true
            })

            selected.set({ id, data: newData })
            return
        }

        // Special handling for scripture tabs: shift+click to select range from active to clicked
        if (e.shiftKey && id.toString().includes("category_scripture")) {
            // WIP this is bad, find the last selected elem of same type instead of the active one
            const activeScriptureId = $drawerTabsData.scripture?.activeSubTab
            if (activeScriptureId && activeScriptureId !== data) {
                // Get all scripture keys of the same type (API or local)
                const activeScripture = $scriptures[activeScriptureId]
                const currentScripture = $scriptures[data]
                if (activeScripture && currentScripture && !!activeScripture.api === !!currentScripture.api) {
                    // Get all scriptures of the same type
                    const allScriptureIds = Object.keys($scriptures).filter((scriptureId) => {
                        const scripture = $scriptures[scriptureId]
                        return scripture && !!scripture.api === !!activeScripture.api
                    })

                    // Find indices of active and clicked scriptures
                    const activeIndex = allScriptureIds.indexOf(activeScriptureId)
                    const clickedIndex = allScriptureIds.indexOf(data)

                    if (activeIndex !== -1 && clickedIndex !== -1) {
                        const startIndex = Math.min(activeIndex, clickedIndex)
                        const endIndex = Math.max(activeIndex, clickedIndex)

                        // Select all scriptures in the range
                        const selectedRange = allScriptureIds.slice(startIndex, endIndex + 1)
                        selected.set({ id, data: selectedRange })
                        return
                    }
                }
            }
        }

        let alreadySelected: boolean = $selected.id === id && arrayHasData($selected.data, data)
        let selectMultiple: boolean = e.ctrlKey || e.metaKey || e.shiftKey || e.buttons === 4 // middle mouse button

        if (dragged) {
            if (alreadySelected) return
            // selectMultiple
            newData = [data]
        } else {
            if (alreadySelected) {
                // if (rightClick) return
                if (!selectMultiple || rightClick) return

                // remove currently selected
                newData = $selected.data.filter((a) => JSON.stringify(a) !== JSON.stringify(data))
            } else if (selectMultiple) {
                // && $selected.id === id
                let selectedData = $selected.data ?? []
                if (!Array.isArray(selectedData)) selectedData = [$selected.data]
                newData = [...selectedData, data]
            } else if (rightClick) {
                newData = [data]
            }
        }

        if (!newData?.length) selected.set({ id: null, data: [] })
        else if (newData) selected.set({ id, data: newData })
    }

    function deselect(e: any) {
        if (e.ctrlKey || e.metaKey || !remainSelected(e)) return
        if (e.target.closest(".menus") || e.target.closest(".selectElem") || e.target.closest(".popup") || e.target.closest(".edit") || e.target.closest(".contextMenu") || e.target.closest(".editTools")) return

        selected.set({ id: null, data: [] })
    }

    function remainSelected(e: any, dragged = false) {
        if (!dragged && $selected.id === "slide" && e.button === 0 && e.target.closest("#template")) return true
        if ($selected.id === id) return true
        return false
    }

    let dragover: null | "start" | "center" | "end" = null
    let dragActive = false

    function dragstart() {
        if ($activeRename !== null || $disableDragging) return

        dragActive = true
    }

    function endDrag() {
        dragActive = false
        dragover = null
        activeDropId.set("")
        if ($selected.id !== id) selected.set({ id, data: [] })
    }

    let thisId = "_" + uid(5)
    $: if ($activeDropId !== thisId) dragover = null
    function stopDrag(e) {
        if (e.target?.classList.contains("TriggerBlock") && e.target?.closest("#" + thisId)) return

        // TODO: allow dropping over borders (edges)
        // if (e.target?.closest(".selectElem") === elem) return

        dragover = null
    }

    function dragOver(key: "start" | "center" | "end") {
        if (!selectable) return
        dragover = key
        triggerHoverAction()
        activeDropId.set(thisId)
    }
</script>

<svelte:window
    on:mousedown={deselect}
    on:dragstart={dragstart}
    on:dragend={endDrag}
    on:touchend={touchend}
    on:touchcancel={touchend}
    on:click={() => {
        dragActive = false
        fileOver = false
        dragover = null
        activeDropId.set("")
    }}
/>

<div
    {id}
    data-item={JSON.stringify(data)}
    {draggable}
    style={$$props.style}
    class="selectElem {$$props.class || ''}"
    class:fill
    class:isSelected={$selected.id === id && arrayHasData($selected.data, data)}
    bind:this={elem}
    on:mouseenter={enter}
    on:mousedown={mousedown}
    on:dragstart={(e) => mousedown(e, true)}
>
    <!-- on:mouseup={mouseup}
    on:contextmenu={contextmenu} -->
    <!-- TODO: validateDrop(id, $selected.id, true) -->
    {#if trigger && (dragActive || fileOver)}
        <div id={thisId} class="trigger {trigger} {dragover ? dragover : ''}" style="flex-direction: {trigger};" on:dragleave={stopDrag}>
            {#if dropAbove}
                <span id="start" class="TriggerBlock over" />
            {/if}

            {#if borders === "all" || borders === "edges"}
                <span id="start" class="TriggerBlock" on:dragover={() => dragOver("start")} />
            {/if}
            {#if borders === "all" || borders === "center"}
                <span id="start_center" class="TriggerBlock" on:dragover={() => dragOver("center")} />
                <span id="end_center" class="TriggerBlock" on:dragover={() => dragOver("center")} />
            {/if}
            {#if borders === "all" || borders === "edges"}
                <span id="end" class="TriggerBlock" on:dragover={() => dragOver("end")} />
            {/if}

            <!-- center drop -->
            <span id="end" class="TriggerBlock between" />
        </div>
    {/if}
    <slot {elem} />
</div>

<style>
    .selectElem {
        position: relative;
    }

    div.isSelected {
        /* outline: 2px solid red;
    outline-offset: 2px; */
        background-color: var(--focus);
        outline: 2px solid var(--text);
        opacity: 0.9;

        /* filter: invert(1); */
        /* filter: sepia(1); */
        /* filter: saturate(5); */
        filter: invert(0.1) brightness(1.2) contrast(0.7);
    }
    div.isSelected :global(button) {
        background-color: inherit !important;
    }

    .fill {
        width: 100%;
        height: 100%;
    }

    .trigger {
        display: flex;
        height: 100%;
        width: 100%;
        position: absolute;
        z-index: 1;
        border-style: solid;
        border-color: var(--secondary);
        border-width: 0px;
        --border-width: 2px;
    }
    .trigger.column.start {
        border-top-width: var(--border-width);
    }
    .trigger.column.end {
        border-bottom-width: var(--border-width);
    }
    .trigger.row.start {
        border-inline-start-width: var(--border-width);
    }
    .trigger.row.end {
        border-inline-end-width: var(--border-width);
    }
    .trigger.center {
        border-width: var(--border-width);
    }

    .trigger span {
        width: 100%;
        height: 100%;
    }

    .between {
        position: absolute;
        background-color: transparent;

        --border-width: 8px;
    }
    .trigger.column .between {
        bottom: calc(var(--border-width) / 2 * -1);
        width: 100%;
        height: var(--border-width);
    }
    .trigger.row .between {
        inset-inline-end: calc(var(--border-width) / 2 * -1);
        height: 100%;
        width: var(--border-width);
    }

    .trigger span.over {
        position: absolute;
        top: 0;
        transform: translateY(-100%);

        height: 10px;
        display: flex;
    }
</style>
