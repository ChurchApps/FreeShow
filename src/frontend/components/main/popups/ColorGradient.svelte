<script lang="ts">
    import { activePopup, popupData } from "../../../stores"
    import { translateText } from "../../../utils/language"
    import { splitGradientValue } from "../../helpers/color"
    import Icon from "../../helpers/Icon.svelte"
    import T from "../../helpers/T.svelte"
    import InputRow from "../../input/InputRow.svelte"
    import MaterialButton from "../../inputs/MaterialButton.svelte"
    import MaterialColorInput from "../../inputs/MaterialColorInput.svelte"
    import MaterialDropdown from "../../inputs/MaterialDropdown.svelte"
    import MaterialNumberInput from "../../inputs/MaterialNumberInput.svelte"
    import MaterialRadialPicker from "../../inputs/MaterialRadialPicker.svelte"

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
        $popupData.trigger(newValue)
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

    function moveUp(index: number) {
        let currentColor = parsedValue.colors[index].color
        parsedValue.colors[index].color = parsedValue.colors[index - 1].color
        parsedValue.colors[index - 1].color = currentColor
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
    {#each parsedValue.colors as colorPart, i}
        {@const pos = colorPart.pos || 0}
        {@const prevPos = parsedValue.colors[i - 1]?.pos || 0}
        {@const nextPos = parsedValue.colors[i + 1]?.pos || 100}

        <InputRow>
            <MaterialColorInput style="min-width: 50%;" label="edit.color" value={colorPart.color} on:input={(e) => (colorPart.color = e.detail)} />
            <!-- WIP also change background opacity -->
            <MaterialNumberInput label="settings.position" value={pos} min={prevPos} max={nextPos} on:change={(e) => (colorPart.pos = e.detail)} currentProgress={pos} showSlider />
            {#if i > 0}
                <MaterialButton icon="up" on:click={() => moveUp(i)} />
            {/if}
            {#if parsedValue.colors.length > 2}
                <MaterialButton title={translateText("actions.delete")} on:click={() => deleteColor(i)}>
                    <Icon id="delete" white />
                </MaterialButton>
            {/if}
        </InputRow>
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
