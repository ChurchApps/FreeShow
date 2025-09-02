<script lang="ts">
    import { createEventDispatcher, onMount } from "svelte"
    import type { DropdownOptions } from "../../../types/Input"
    import { getFontStyleList, getSystemFontsList } from "../helpers/fonts"
    import MaterialDropdown from "./MaterialDropdown.svelte"
    import InputRow from "../input/InputRow.svelte"

    export let label: string
    export let value: string
    export let fontStyleValue: string = ""

    let systemFontsList: DropdownOptions = []
    let fontsStylesList: DropdownOptions = []

    onMount(async () => {
        systemFontsList = await getSystemFontsList()
    })

    let defaultFontStyleValue = ""
    $: if (value) updateStyles()
    function updateStyles() {
        const { fontStyles, defaultValue } = getFontStyleList(value)
        fontsStylesList = fontStyles
        defaultFontStyleValue = defaultValue
    }

    const dispatch = createEventDispatcher()
    function change(e) {
        let value = e.detail
        fontStyleValue = ""
        dispatch("change", value)
    }
    function styleChange(e) {
        fontStyleValue = e.detail
        dispatch("fontStyle", fontStyleValue)
    }
</script>

<InputRow style={$$props.style || ""}>
    <MaterialDropdown {label} options={systemFontsList} {value} on:change={change} />
    {#if fontsStylesList.length > 1}
        <MaterialDropdown label="settings.font_style" options={fontsStylesList} value={fontStyleValue || defaultFontStyleValue} on:change={styleChange} onlyArrow />
    {/if}
</InputRow>
