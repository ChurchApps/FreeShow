<script lang="ts">
    import { popupData } from "../../../stores"
    import T from "../../helpers/T.svelte"
    import InputRow from "../../input/InputRow.svelte"
    import MaterialButton from "../../inputs/MaterialButton.svelte"
    import MaterialColorInput from "../../inputs/MaterialColorInput.svelte"
    import MaterialTextInput from "../../inputs/MaterialTextInput.svelte"

    const defaultColors = ["#3b82f6", "#10b981", "#f59e0b", "#ec4899", "#8b5cf6", "#f43f5e", "#06b6d4", "#14b8a6"]

    function getDefaultColor(rowIdx: number, currentGrid: string[][]) {
        if (rowIdx === 0) return defaultColors[0]
        const hasHeader = currentGrid[0] && currentGrid[0][0] === "Label" && isNaN(parseFloat(currentGrid[0][1]))
        const dataIdx = hasHeader ? rowIdx - 1 : rowIdx
        return defaultColors[dataIdx % defaultColors.length]
    }

    let grid: string[][] = [["", "0", defaultColors[0]]]
    try {
        if ($popupData.active) {
            const parsed = JSON.parse($popupData.active)
            if (Array.isArray(parsed) && parsed.every((row) => Array.isArray(row))) {
                const temp = parsed.map((row) => {
                    const label = row[0] || ""
                    const val = row[1] || "0"
                    return [label, val, row[2] || ""]
                })
                grid = temp.map((row, rowIdx) => {
                    if (!row[2]) {
                        row[2] = getDefaultColor(rowIdx, temp)
                    }
                    return row
                })
            }
        }
    } catch (e) {
        if ($popupData.active && typeof $popupData.active === "string") {
            const lines = $popupData.active.split("\n").filter((l) => l.trim())
            const temp = lines.map((line) => {
                const parts = line.split(":")
                return [parts[0].trim(), parts[1] ? parts[1].trim() : "0", ""]
            })
            grid = temp.map((row, rowIdx) => {
                row[2] = getDefaultColor(rowIdx, temp)
                return row
            })
        }
    }

    if (grid.length === 0) {
        grid = [["", "0", defaultColors[0]]]
    }

    // Trigger immediate updates on change
    $: if (grid && $popupData.trigger) {
        $popupData.trigger(JSON.stringify(grid))
    }

    function addRow() {
        const nextColor = getDefaultColor(grid.length, grid)
        grid = [...grid, ["", "0", nextColor]]
    }

    function removeRow(idx: number) {
        if (grid.length <= 1) return
        grid = grid.filter((_, i) => i !== idx)
    }
</script>

<div style="display: flex;flex-direction: column;">
    {#each grid as _row, rowIdx}
        <InputRow>
            <!-- <span>{rowIdx + 1}</span> -->

            <MaterialTextInput
                label="inputs.name"
                value={grid[rowIdx][0]}
                on:input={(e) => {
                    grid[rowIdx][0] = e.detail
                    grid = grid
                }}
            />
            <MaterialTextInput
                label="variables.value"
                value={grid[rowIdx][1] || ""}
                on:input={(e) => {
                    grid[rowIdx][1] = e.detail
                    grid = grid
                }}
            />
            <MaterialColorInput
                label="edit.color"
                value={grid[rowIdx][2] || getDefaultColor(rowIdx, grid)}
                on:change={(e) => {
                    grid[rowIdx][2] = e.detail
                    grid = grid
                }}
                noLabel
            />

            <MaterialButton variant="outlined" icon="delete" disabled={grid.length <= 1} on:click={() => removeRow(rowIdx)} red />
        </InputRow>
    {/each}

    <MaterialButton variant="outlined" icon="add" on:click={addRow}>
        <T id="settings.add" />
    </MaterialButton>
</div>
