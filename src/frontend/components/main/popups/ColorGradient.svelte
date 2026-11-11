<script lang="ts">
    import { activePopup, popupData } from "../../../stores"
    import { translateText } from "../../../utils/language"
    import { registerPopupSubmit } from "../../../utils/popup"
    import DragItemWrapper from "../../helpers/DragItemWrapper.svelte"
    import Icon from "../../helpers/Icon.svelte"
    import T from "../../helpers/T.svelte"
    import { splitGradientValue } from "../../helpers/color"
    import { createDragReorder } from "../../helpers/dragReorder"
    import InputRow from "../../input/InputRow.svelte"
    import MaterialButton from "../../inputs/MaterialButton.svelte"
    import MaterialColorInput from "../../inputs/MaterialColorInput.svelte"
    import MaterialDropdown from "../../inputs/MaterialDropdown.svelte"
    import MaterialNumberInput from "../../inputs/MaterialNumberInput.svelte"
    import MaterialRadialPicker from "../../inputs/MaterialRadialPicker.svelte"

    registerPopupSubmit(change)

    const DEFAULT = "linear-gradient(120deg, rgb(255 128 212) 0%, rgb(193 47 106) 62%, rgb(167 19 45) 100%)"

    let value = $popupData.value || ""
    if (!value.includes("gradient")) value = DEFAULT

    let parsedValue = splitGradientValue(value)

    let newValue = ""
    function setNewValue() {
        let currentType = activeType
        let currentDeg = currentType === "radial-gradient" ? activeShape : `${parsedValue.deg}deg`
        let currentColors = parsedValue.colors?.map(({ color, pos }) => `${color} ${pos}%`)
        newValue = `${currentType}(${currentDeg},${currentColors.join(",")})`
    }
    $: if (activeType || activeShape || parsedValue) setNewValue()

    function change() {
        if ($popupData.trigger) $popupData.trigger(newValue)
        popupData.set({})
        activePopup.set(null)
    }

    const types = [
        { value: "linear-gradient", label: translateText("color.linear") },
        { value: "radial-gradient", label: translateText("color.radial") }
    ]
    let activeType = parsedValue.type || "linear-gradient"

    const shapes = [
        { value: "circle", label: translateText("color.circle") },
        { value: "ellipse", label: translateText("color.ellipse") }
    ]
    let activeShape = parsedValue.shape || "circle"

    const dragReorder = createDragReorder((fromIndices, toIndex) => {
        parsedValue.colors = getReorderedColors(parsedValue.colors, fromIndices, toIndex)
    })
    const { dragOverIndex, draggedIndices } = dragReorder

    function getReorderedColors(colors: any[], from: number[], to: number | null) {
        const reordered = dragReorder.getReorderedList(colors || [], from, to)
        return reordered.map((item, idx) => ({ ...item, pos: colors[idx]?.pos ?? item.pos }))
    }

    $: displayColors = getReorderedColors(parsedValue.colors, $draggedIndices, $dragOverIndex)
    $: isPlaceholderActive = $dragOverIndex !== null

    function updateColor(index: number, key: "color" | "pos", val: any) {
        ;(parsedValue.colors[index] as any)[key] = val
        parsedValue.colors = parsedValue.colors
        setNewValue()
    }

    function deleteColor(index: number) {
        parsedValue.colors.splice(index, 1)
        parsedValue.colors = parsedValue.colors
    }
</script>

<!-- preview -->
<div class="preview" style="background: {newValue};"></div>

<InputRow>
    <MaterialDropdown label="sort.type" value={activeType} options={types} on:change={(e) => (activeType = e.detail)} />

    {#if activeType === "radial-gradient"}
        <MaterialDropdown label="color.shape" value={activeShape} options={shapes} on:change={(e) => (activeShape = e.detail)} />
    {:else}
        <MaterialRadialPicker label="color.angle" value={parsedValue.deg} on:change={(e) => (parsedValue.deg = e.detail)} />
    {/if}
</InputRow>

<div class="colors" style="margin-top: 10px;">
    {#each displayColors as colorPart, i}
        {@const pos = colorPart.pos || 0}
        {@const prevPos = parsedValue.colors[i - 1]?.pos || 0}
        {@const nextPos = parsedValue.colors[i + 1]?.pos || 100}
        {@const isPlaceholder = isPlaceholderActive && $draggedIndices.some((dIdx) => colorPart.color === parsedValue.colors[dIdx]?.color)}

        <DragItemWrapper index={i} controller={dragReorder} {isPlaceholder} handleOnly>
            <InputRow style="width: 100%;">
                <span class="drag_handle" style="display: flex;align-items: center;cursor: grab;opacity: 0.6;padding: 0 3px;background-color: var(--primary-darkest);border-bottom: 1.2px solid var(--primary-lighter);">
                    <Icon id="drag_dots" size={1.2} white />
                </span>

                <MaterialColorInput style="min-width: 50%;" label="edit.color" value={colorPart.color} on:input={(e) => updateColor(i, "color", e.detail)} allowOpacity />
                <MaterialNumberInput label="settings.position" value={pos} min={prevPos} max={nextPos} on:change={(e) => updateColor(i, "pos", e.detail)} currentProgress={pos} showSlider />

                {#if parsedValue.colors.length > 2}
                    <MaterialButton title={translateText("actions.delete")} on:click={() => deleteColor(i)}>
                        <Icon id="delete" white />
                    </MaterialButton>
                {/if}
            </InputRow>
        </DragItemWrapper>
    {/each}

    <MaterialButton
        variant="outlined"
        icon="add"
        style="width: 100%;"
        on:click={() => {
            parsedValue.colors.push({ color: "#ffffff", pos: 100 })
            parsedValue.colors = parsedValue.colors
        }}
        white
    >
        <T id="settings.add" />
    </MaterialButton>
</div>

<MaterialButton variant="contained" icon="save" on:click={change} style="width: 100%;margin-top: 20px;">
    <T id="actions.save" />
</MaterialButton>

<style>
    .preview {
        width: 100%;
        height: 80px;

        margin-bottom: 20px;
        border-radius: 5px;
        border: 2px solid var(--text);
    }

    .colors {
        display: flex;
        flex-direction: column;
    }
</style>
