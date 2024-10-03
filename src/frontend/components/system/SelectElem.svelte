<script lang="ts">
    import type { SelectIds } from "../../../types/Main"
    import { activeRename, activeShow, os, selected } from "../../stores"
    import { arrayHasData, clone } from "../helpers/array"
    import { _show } from "../helpers/shows"

    export let id: SelectIds
    export let data: any
    export let fill: boolean = false
    export let draggable: boolean = false
    export let shiftRange: any[] = []
    export let onlyRightClickSelect: boolean = false
    export let selectable: boolean = true
    export let trigger: null | "row" | "column" = null
    export let fileOver: boolean = false
    export let borders: "all" | "center" | "edges" = "all"
    export let triggerOnHover: boolean = false
    let elem: any

    function enter(e: any) {
        if (!selectable) return
        if (!e.buttons || dragActive || onlyRightClickSelect) return

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
    let triggerTimeout: any = null
    function triggerHoverAction() {
        if (!triggerOnHover || triggerTimeout) return

        triggerTimeout = setTimeout(() => {
            triggerTimeout = null
            if (!dragover) return
            if (!triggerHoverActions[id]) return console.log("MISSING HOVER TRIGGER:", id)

            triggerHoverActions[id]()
        }, TRIGGER_TIMEOUT)
    }

    const triggerHoverActions: any = {
        show: () => {
            if (($selected.id === "slide" || $selected.id === "group" || $selected.id === "global_group") && (data.type || "show") === "show") {
                // copy slide data
                if ($selected.id === "slide") {
                    let slides: any[] = convertDataToSlide($selected.data)
                    // select after show is opened (because a slide is selected in the new show)
                    setTimeout(() => {
                        selected.set({ id: "global_group", data: slides }) // , overrideDrop: true
                    }, 50)
                }
                // open show
                activeShow.set(data)
            }
        },
    }

    function convertDataToSlide(slideRef: { index: number }[]) {
        let currentSlides = _show().get("slides")
        let currentMedia = _show().get("media") || {}
        let currentLayoutRef = _show().layouts("active").ref()[0]

        let slideData = slideRef.map(({ index }) => {
            let layout = currentLayoutRef[index] || {}
            let layoutMedia: any = {}
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

    // mac bug causes two finger trackpad to not register as a button 2 input,
    // this could be a workaround, but contetxmenu is triggered last!
    // let rightClickMenu = false
    // function contextmenu() {
    //     rightClickMenu = true
    // }
    // function mouseup() {
    //     rightClickMenu = false
    // }

    function mousedown(e: any, dragged: boolean = false) {
        if (!selectable) return
        if (dragged && $activeRename !== null) return e.preventDefault()

        if ($selected.id !== id) selected.set({ id, data: [] })

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
            let lastSelectedIndex = shiftRange.length ? shiftRange.findLastIndex((a) => searchKeys.find((key) => lastSelected[key] !== undefined && lastSelected[key] === a[key])) : lastSelected.index
            let newIndex = shiftRange.length ? shiftRange.findIndex((a) => searchKeys.find((key) => data[key] !== undefined && data[key] === a[key])) : data.index
            let lowestNumber = Math.min(lastSelectedIndex, newIndex) + 1
            let highestNumber = Math.max(lastSelectedIndex, newIndex) - 1

            let selectedBetween: number[] = range(lowestNumber, highestNumber)
            function range(start, end) {
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
                newData = $selected.data.filter((a: any) => JSON.stringify(a) !== JSON.stringify(data))
            } else if (selectMultiple) {
                // && $selected.id === id
                newData = [...$selected.data, data]
            } else if (rightClick) newData = [data]
        }

        if (!newData?.length) selected.set({ id: null, data: [] })
        else if (newData) selected.set({ id, data: newData })
    }

    function deselect(e: any) {
        if (e.ctrlKey || e.metaKey || $selected.id !== id) return
        if (e.target.closest(".menus") || e.target.closest(".selectElem") || e.target.closest(".popup") || e.target.closest(".edit") || e.target.closest(".contextMenu") || e.target.closest(".editTools")) return

        selected.set({ id: null, data: [] })
    }

    let dragover: null | "start" | "center" | "end" = null
    let dragActive: boolean = false

    function endDrag() {
        dragActive = false
        dragover = null
        if ($selected.id !== id) selected.set({ id, data: [] })
    }

    function stopDrag() {
        // TODO: allow dropping over borders (edges)
        // if (e.target?.closest(".selectElem") === elem) return

        dragover = null
    }

    function dragOver(key: "start" | "center" | "end") {
        if (!selectable) return
        dragover = key
        triggerHoverAction()
    }
</script>

<svelte:window
    on:mousedown={deselect}
    on:dragstart={() => {
        if ($activeRename !== null) return

        dragActive = true
    }}
    on:dragend={endDrag}
    on:click={() => {
        dragActive = false
        fileOver = false
        dragover = null
    }}
/>

<div
    {id}
    data={JSON.stringify(data)}
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
        <div class="trigger {trigger} {dragover ? dragover : ''}" style="flex-direction: {trigger};" on:dragleave={stopDrag}>
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
        outline: 2px solid var(--secondary-text);
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
    }
    .trigger.column.start {
        border-top-width: 2px;
    }
    .trigger.column.end {
        border-bottom-width: 2px;
    }
    .trigger.row.start {
        border-left-width: 2px;
    }
    .trigger.row.end {
        border-right-width: 2px;
    }
    .trigger.center {
        border-width: 2px;
    }

    .trigger span {
        width: 100%;
        height: 100%;
    }
</style>
