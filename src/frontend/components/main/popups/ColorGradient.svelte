<script lang="ts">
    import { activePopup, dictionary, popupData } from "../../../stores"
    import { splitGradientValue } from "../../helpers/color"
    import Icon from "../../helpers/Icon.svelte"
    import T from "../../helpers/T.svelte"
    import Button from "../../inputs/Button.svelte"
    import Color from "../../inputs/Color.svelte"
    import CombinedInput from "../../inputs/CombinedInput.svelte"
    import Dropdown from "../../inputs/Dropdown.svelte"
    import NumberInput from "../../inputs/NumberInput.svelte"

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
        { name: "$:color.linear:$", id: "linear-gradient" },
        { name: "$:color.radial:$", id: "radial-gradient" }
    ]
    let activeType = parsedValue.type || "linear-gradient"

    const shapes = [
        { name: "$:color.circle:$", id: "circle" },
        { name: "$:color.ellipse:$", id: "ellipse" }
    ]
    let activeShape = parsedValue.shape || "circle"
</script>

<!-- preview -->
<div class="preview" style="background: {newValue};"></div>

<CombinedInput>
    <p><T id="sort.type" /></p>
    <Dropdown value={types.find((a) => a.id === activeType)?.name || ""} options={types} on:click={(e) => (activeType = e.detail.id)} />
</CombinedInput>

{#if activeType === "radial-gradient"}
    <CombinedInput>
        <p><T id="color.shape" /></p>
        <Dropdown value={shapes.find((a) => a.id === activeShape)?.name || ""} options={shapes} on:click={(e) => (activeShape = e.detail.id)} />
    </CombinedInput>
{:else}
    <CombinedInput>
        <p><T id="color.angle" /></p>
        <NumberInput value={parsedValue.deg} max={360} on:change={(e) => (parsedValue.deg = e.detail)} />
    </CombinedInput>
{/if}

<div class="colors">
    {#each parsedValue.colors as colorPart, i}
        <CombinedInput>
            <!-- <input style="width: 50%;" class="colorpicker" type="color" value={color.color} on:input={(e) => updateColorValue(e, i)} /> -->
            <Color style="width: 50%;" value={colorPart.color} on:input={(e) => (colorPart.color = e.detail)} />
            <!-- WIP also change background opacity -->
            <span style="display: flex;width: 50%">
                <NumberInput value={colorPart.pos || 0} min={parsedValue.colors[i - 1]?.pos || 0} max={parsedValue.colors[i + 1]?.pos || 100} on:change={(e) => (colorPart.pos = e.detail)} />
                {#if i > 0}
                    <Button
                        title={$dictionary.actions?.delete}
                        on:click={() => {
                            let currentColor = colorPart.color
                            parsedValue.colors[i].color = parsedValue.colors[i - 1].color
                            parsedValue.colors[i - 1].color = currentColor
                        }}
                    >
                        <Icon id="up" />
                    </Button>
                {/if}
                {#if parsedValue.colors.length > 2}
                    <Button
                        title={$dictionary.actions?.delete}
                        on:click={() => {
                            parsedValue.colors.splice(i, 1)
                            parsedValue.colors = parsedValue.colors
                        }}
                    >
                        <Icon id="delete" />
                    </Button>
                {/if}
            </span>
        </CombinedInput>
    {/each}

    <CombinedInput>
        <Button
            style="width: 100%;"
            on:click={() => {
                parsedValue.colors.push({ color: "#ffffff", pos: 100 })
                parsedValue.colors = parsedValue.colors
            }}
            center
            dark
        >
            <Icon id="add" right />
            <T id="settings.add" />
        </Button>
    </CombinedInput>
</div>

<CombinedInput style="margin-top: 10px;">
    <Button on:click={change} style="width: 100%;" dark center>
        <!-- WIP select -->
        <Icon id="check" size={1.2} right />
        <T id="actions.done" />
    </Button>
</CombinedInput>

<style>
    .preview {
        width: 100%;
        height: 80px;

        margin-bottom: 10px;
        border-radius: 3px;
        border: 2px solid var(--text);
    }

    .colors {
        display: flex;
        flex-direction: column;
    }
</style>
