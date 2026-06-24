<script lang="ts">
    import { tick, onMount } from "svelte"
    import type { Item } from "../../../../types/Show"
    import { activeEdit, showsCache } from "../../../stores"
    import { clone } from "../../helpers/array"
    import { getStyles } from "../../helpers/style"
    import Icon from "../../helpers/Icon.svelte"

    export let item: Item
    export let edit = false
    export let ref: any = {}
    export let ratio = 1

    $: tableData = item.table || {
        borderColor: "rgba(255,255,255,0.2)",
        borderWidth: 1,
        rows: [
            {
                cells: [
                    { text: "", style: "font-weight: bold; background-color: rgba(255, 255, 255, 0.05);" },
                    { text: "", style: "font-weight: bold; background-color: rgba(255, 255, 255, 0.05);" },
                    { text: "", style: "font-weight: bold; background-color: rgba(255, 255, 255, 0.05);" }
                ]
            },
            { cells: [{ text: "" }, { text: "" }, { text: "" }] },
            { cells: [{ text: "" }, { text: "" }, { text: "" }] }
        ]
    }

    $: rows = tableData.rows || []
    $: borderColor = tableData.borderColor || "rgba(255,255,255,0.2)"
    $: borderWidth = tableData.borderWidth !== undefined ? tableData.borderWidth : 1

    $: alignStyles = getStyles(item.align || "")
    $: verticalAlign = alignStyles["align-items"] || "center"
    $: textAlign = alignStyles["text-align"] || "center"

    function updateItem() {
        if (!ref?.showId || $activeEdit.slide === null) return
        showsCache.update((cache) => {
            const show = cache[ref.showId]
            if (!show) return cache
            const slide = show.slides[ref.id]
            if (!slide) return cache
            const items = slide.items
            const itemIndex = items.findIndex((i) => i.id === item.id)
            if (itemIndex > -1) {
                items[itemIndex].table = clone(tableData)
            }
            return cache
        })
    }

    function addRow(index: number) {
        const colCount = rows[0]?.cells?.length || 3
        let refRowIdx = index - 1
        if (refRowIdx < 0 && rows.length > 0) {
            refRowIdx = 0
        }
        const newCells = Array.from({ length: colCount }, (_, colIdx) => {
            const style = (refRowIdx >= 0 && rows[refRowIdx]?.cells?.[colIdx]?.style) || undefined
            return style ? { text: "", style } : { text: "" }
        })
        tableData.rows.splice(index, 0, { cells: newCells })
        tableData = tableData
        updateItem()
    }

    function deleteRow(index: number) {
        if (rows.length <= 1) return
        tableData.rows.splice(index, 1)
        tableData = tableData
        updateItem()
    }

    function addColumn(index: number) {
        tableData.rows.forEach((row) => {
            let refColIdx = index - 1
            if (refColIdx < 0 && row.cells.length > 0) {
                refColIdx = 0
            }
            const style = (refColIdx >= 0 && row.cells[refColIdx]?.style) || undefined
            const newCell = style ? { text: "", style } : { text: "" }
            row.cells.splice(index, 0, newCell)
        })
        tableData = tableData
        updateItem()
    }

    function deleteColumn(index: number) {
        const colCount = rows[0]?.cells?.length || 0
        if (colCount <= 1) return
        tableData.rows.forEach((row) => {
            row.cells.splice(index, 1)
        })
        tableData = tableData
        updateItem()
    }

    async function handleCellKeydown(e: KeyboardEvent, rIdx: number, cIdx: number) {
        if (e.key === "Tab") {
            const isLastRow = rIdx === rows.length - 1
            const isLastCol = cIdx === rows[rIdx].cells.length - 1
            if (isLastRow && isLastCol && !e.shiftKey) {
                e.preventDefault()
                addRow(rows.length)
                await tick()
                // Wait for the next macro-task to ensure Svelte has mounted the new row in the DOM
                setTimeout(() => {
                    const rowsList = containerElem?.querySelectorAll("tr")
                    if (rowsList && rowsList.length > 0) {
                        const newRowEl = rowsList[rowsList.length - 1]
                        const cellEl = newRowEl?.querySelector("[contenteditable]") as HTMLElement | null
                        if (cellEl) {
                            cellEl.focus()

                            // Collapse caret to the beginning of text
                            const selection = window.getSelection()
                            const range = document.createRange()
                            range.selectNodeContents(cellEl)
                            range.collapse(true)
                            selection?.removeAllRanges()
                            selection?.addRange(range)
                        }
                    }
                }, 100)
            }
        }
    }

    let lastRightClickedRow: number | null = null
    let lastRightClickedCol: number | null = null

    function handleContextMenu(rIdx: number, cIdx: number) {
        lastRightClickedRow = rIdx
        lastRightClickedCol = cIdx
    }

    let containerElem: HTMLElement | undefined

    onMount(() => {
        const handleDelRow = () => {
            if (lastRightClickedRow !== null) {
                deleteRow(lastRightClickedRow)
                lastRightClickedRow = null
                lastRightClickedCol = null
            }
        }
        const handleDelCol = () => {
            if (lastRightClickedCol !== null) {
                deleteColumn(lastRightClickedCol)
                lastRightClickedRow = null
                lastRightClickedCol = null
            }
        }
        window.addEventListener("delete-row", handleDelRow)
        window.addEventListener("delete-col", handleDelCol)
        return () => {
            window.removeEventListener("delete-row", handleDelRow)
            window.removeEventListener("delete-col", handleDelCol)
        }
    })
    let isAnyCellFocused = false

    function handleFocusOut(e: FocusEvent) {
        if (!containerElem?.contains(e.relatedTarget as Node)) {
            isAnyCellFocused = false
        }
    }
</script>

<div bind:this={containerElem} class="table-view-container" class:edit-mode={edit} style="--ratio-zoom: {ratio || 1};" on:focusin={() => (isAnyCellFocused = true)} on:focusout={handleFocusOut}>
    <table style="border: {borderWidth}px solid {borderColor}; border-collapse: collapse; width: 100%; height: 100%;">
        <tbody>
            {#each rows as row, rIdx}
                <tr style="border-bottom: {borderWidth}px solid {borderColor};">
                    {#each row.cells as cell, cIdx}
                        <td class={edit ? "context #edit_box__table_context" : ""} data-row={rIdx} data-col={cIdx} on:contextmenu={() => handleContextMenu(rIdx, cIdx)} style="border-right: {borderWidth}px solid {borderColor}; position: relative; padding: 0; text-align: {textAlign}; --vertical-align: {verticalAlign}; {cell.style || ''}">
                            {#if edit}
                                <div class="cell-content edit" contenteditable="true" bind:textContent={cell.text} on:input={updateItem} on:keydown={(e) => handleCellKeydown(e, rIdx, cIdx)} style="padding: 8px 12px; width: 100%; height: 100%; outline: none; box-sizing: border-box; min-height: 38px;"></div>
                            {:else}
                                <div class="cell-content" style="padding: 8px 12px; width: 100%; height: 100%; box-sizing: border-box; min-height: 38px;">
                                    {cell.text}
                                </div>
                            {/if}
                        </td>
                    {/each}
                </tr>
            {/each}
        </tbody>
    </table>

    {#if edit && isAnyCellFocused}
        <!-- Plus circle button at the right center -->
        <button tabindex="-1" class="circle-add-btn right-btn" on:mousedown|stopPropagation on:click|stopPropagation={() => addColumn(rows[0]?.cells?.length || 0)} title="Add Column">
            <Icon id="add" size={3.2} white />
        </button>
        <!-- Plus circle button at the bottom center -->
        <button tabindex="-1" class="circle-add-btn bottom-btn" on:mousedown|stopPropagation on:click|stopPropagation={() => addRow(rows.length)} title="Add Row">
            <Icon id="add" size={3.2} white />
        </button>
    {/if}
</div>

<style>
    .table-view-container {
        width: 100%;
        height: 100%;
        color: inherit;
        font-family: inherit;
        overflow: visible;
        position: relative;
    }

    table {
        font-size: inherit;
    }

    td {
        padding: 0;
        min-width: 100px;
        text-align: inherit;
        font-family: inherit;
        color: inherit;
    }

    .cell-content {
        display: flex;
        flex-direction: column;
        justify-content: var(--vertical-align, center);
        text-align: inherit;
    }

    /* Plus circle buttons */
    .circle-add-btn {
        position: absolute;
        background: #ffffff;
        border: 1px solid rgba(0, 0, 0, 0.3);
        color: #000000;
        width: calc(28px / var(--ratio-zoom, 1));
        height: calc(28px / var(--ratio-zoom, 1));
        border-radius: 50%;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: bold;
        font-size: calc(18px / var(--ratio-zoom, 1));
        box-shadow: 0 2px 5px rgba(0, 0, 0, 0.3);
        z-index: 25;
        transition: background-color 0.2s ease;
        pointer-events: auto;
        opacity: 1;
    }

    .circle-add-btn:hover {
        background: #f1f5f9;
    }

    .right-btn {
        right: calc(-14px / var(--ratio-zoom, 1));
        top: 50%;
        transform: translateY(-50%);
    }

    .bottom-btn {
        bottom: calc(-14px / var(--ratio-zoom, 1));
        left: 50%;
        transform: translateX(-50%);
    }

    .bottom-btn:hover {
        background: #f1f5f9;
    }
</style>
