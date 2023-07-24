<script lang="ts">
    import type { SelectIds } from "../../../types/Main"
    import { os, selected } from "../../stores"
    import { arrayHasData } from "../helpers/array"

    export let id: SelectIds
    export let data: any
    export let fill: boolean = false
    export let draggable: boolean = false
    export let trigger: null | "row" | "column" = null
    export let fileOver: boolean = false
    export let borders: "all" | "center" | "edges" = "all"
    let elem: any

    function enter(e: any) {
        if (e.buttons && !dragActive) {
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
    }

    function mousedown(e: any, dragged: boolean = false) {
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

        // shift select range
        if (e.shiftKey && $selected.data[0]?.index !== undefined) {
            let lastSelectedIndex = $selected.data[$selected.data.length - 1].index
            let newIndex = data.index
            let lowestNumber = Math.min(lastSelectedIndex, newIndex) + 1
            let highestNumber = Math.max(lastSelectedIndex, newIndex) - 1

            let selectedBetween: number[] = range(lowestNumber, highestNumber)
            function range(start, end) {
                return Array(end - start + 1)
                    .fill("")
                    .map((_, idx) => start + idx)
            }

            let numbersBetween = selectedBetween.map((index) => ({ index }))
            let allNewIndexes = [...$selected.data, ...numbersBetween, data]

            // remove duplicates
            let alreadyAdded: number[] = []
            newData = allNewIndexes.filter(({ index }) => {
                if (alreadyAdded.includes(index)) return false

                alreadyAdded.push(index)
                return true
            })

            selected.set({ id, data: newData })
            return
        }

        let alreadySelected: boolean = $selected.id === id && arrayHasData($selected.data, data)
        let selectMultiple: boolean = e.ctrlKey || e.metaKey || e.shiftKey || e.buttons === 4 // middle mouse button
        let rightClick: boolean = e.buttons === 2 || ($os.platform === "darwin" && e.ctrlKey)

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
        if (
            !e.ctrlKey &&
            !e.metaKey &&
            $selected.id === id &&
            !e.target.closest(".menus") &&
            !e.target.closest(".selectElem") &&
            !e.target.closest(".popup") &&
            !e.target.closest(".edit") &&
            !e.target.closest(".contextMenu") &&
            !e.target.closest(".editTools")
        )
            selected.set({ id: null, data: [] })
    }

    let dragover: null | "start" | "center" | "end" = null
    let dragActive: boolean = false

    function endDrag() {
        dragActive = false
        dragover = null
        if ($selected.id !== id) selected.set({ id, data: [] })
    }
</script>

<svelte:window
    on:mousedown={deselect}
    on:dragstart={() => {
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
    class="selectElem"
    class:fill
    class:isSelected={$selected.id === id && arrayHasData($selected.data, data)}
    bind:this={elem}
    on:mouseenter={enter}
    on:mousedown={mousedown}
    on:dragstart={(e) => mousedown(e, true)}
>
    <!-- TODO: validateDrop(id, $selected.id, true) -->
    {#if trigger && (dragActive || fileOver)}
        <div class="trigger {trigger} {dragover ? dragover : ''}" style="flex-direction: {trigger};" on:dragleave={() => (dragover = null)}>
            {#if borders === "all" || borders === "edges"}
                <span id="start" class="TriggerBlock" on:dragover={() => (dragover = "start")} />
            {/if}
            {#if borders === "all" || borders === "center"}
                <span id="start_center" class="TriggerBlock" on:dragover={() => (dragover = "center")} />
                <span id="end_center" class="TriggerBlock" on:dragover={() => (dragover = "center")} />
            {/if}
            {#if borders === "all" || borders === "edges"}
                <span id="end" class="TriggerBlock" on:dragover={() => (dragover = "end")} />
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
