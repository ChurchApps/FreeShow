<script lang="ts">
    import { createEventDispatcher } from "svelte"
    import { translateText } from "../../utils/language"
    import { hexToHSL, hslToHex } from "../helpers/color"
    import Icon from "../helpers/Icon.svelte"
    import InputRow from "../input/InputRow.svelte"
    import MaterialButton from "./MaterialButton.svelte"
    import MaterialColorInput from "./MaterialColorInput.svelte"

    export let value: string[] = []
    export let label: string = ""
    export let disabled: boolean = false
    export let minColors: number = 1
    export let maxColors: number = 99

    const dispatch = createEventDispatcher()

    $: colors = Array.isArray(value) && value.length ? [...value] : ["#1a1b33", "#2b2d4d", "#7c5f7a", "#e0a98c"]

    $: gradientPreview = colors.length > 1 ? `linear-gradient(90deg, ${colors.join(", ")})` : colors[0] || "#ffffff"

    let open = false

    function getNextGradientColor(list: string[]): string {
        if (!list.length) return "#ffffff"
        if (list.length === 1) {
            const hsl = hexToHSL(list[0])
            return hslToHex((hsl.h + 30) % 360, hsl.s || 60, Math.min(85, Math.max(15, hsl.l + 10)))
        }

        const c1 = list[list.length - 2]
        const c2 = list[list.length - 1]

        const hsl1 = hexToHSL(c1)
        const hsl2 = hexToHSL(c2)

        let dh = hsl2.h - hsl1.h
        if (dh > 180) dh -= 360
        if (dh < -180) dh += 360

        let ds = hsl2.s - hsl1.s
        let dl = hsl2.l - hsl1.l

        if (Math.abs(dh) < 1 && Math.abs(ds) < 1 && Math.abs(dl) < 1) {
            dh = 30
        }

        const nextH = (hsl2.h + dh + 360) % 360
        const nextS = Math.min(100, Math.max(5, hsl2.s + ds))
        const nextL = Math.min(95, Math.max(5, hsl2.l + dl))

        return hslToHex(nextH, nextS, nextL)
    }

    function updateColor(index: number, newColor: string) {
        if (disabled) return
        colors[index] = newColor
        value = [...colors]
        dispatch("input", value)
        dispatch("change", value)
    }

    function addColor() {
        if (disabled || colors.length >= maxColors) return
        const nextColor = getNextGradientColor(colors)
        colors = [...colors, nextColor]
        value = [...colors]
        dispatch("input", value)
        dispatch("change", value)
    }

    function removeColor(index: number) {
        if (disabled || colors.length <= minColors) return
        colors.splice(index, 1)
        colors = [...colors]
        value = [...colors]
        dispatch("input", value)
        dispatch("change", value)
    }
</script>

<div class="colors-input" class:disabled>
    <InputRow arrow bind:open>
        <div class="main-bar" on:click={() => (open = !open)} on:keydown={(e) => e.key === "Enter" && (open = !open)} role="button" tabindex="0">
            <span class="label">{translateText(label || "settings.colors")}</span>
            <div class="gradient-preview" style="background: {gradientPreview};"></div>
            <!-- <span>{colors.length}</span> -->
        </div>

        <svelte:fragment slot="menu">
            {#each colors as color, i}
                <InputRow>
                    <MaterialColorInput label="{translateText('edit.color')} {i + 1}" value={color} on:input={(e) => updateColor(i, e.detail)} on:change={(e) => updateColor(i, e.detail)} allowOpacity />
                    {#if colors.length > minColors}
                        <MaterialButton title="actions.delete" on:click={() => removeColor(i)}>
                            <Icon id="delete" white />
                        </MaterialButton>
                    {/if}
                </InputRow>
            {/each}

            {#if colors.length < maxColors}
                <MaterialButton variant="outlined" icon="add" style="width: 100%; border-radius: 0; padding: 8px; justify-content: center; background-color: var(--primary-darkest);" title="actions.add" on:click={addColor}>
                    <span style="font-size: 0.8rem;">{translateText("actions.add_color")}</span>
                </MaterialButton>
            {/if}
        </svelte:fragment>
    </InputRow>
</div>

<style>
    .colors-input {
        width: 100%;
    }

    .colors-input.disabled {
        opacity: 0.5;
        pointer-events: none;
    }

    .main-bar {
        display: flex;
        align-items: center;
        gap: 10px;
        width: 100%;
        min-height: 50px;
        height: 50px;
        padding: 0 12px;
        background-color: var(--primary-darkest);
        border-bottom: 1.2px solid var(--primary-lighter);
        cursor: pointer;
        user-select: none;
    }

    .label {
        font-weight: 500;
        font-size: 0.9rem;
        opacity: 0.7;
        color: var(--text);
        white-space: nowrap;
    }

    .gradient-preview {
        flex: 1;
        height: 22px;
        border-radius: 4px;
        border: 1px solid var(--primary-lighter);
        box-shadow: inset 0 0 4px rgba(0, 0, 0, 0.3);
    }
</style>
