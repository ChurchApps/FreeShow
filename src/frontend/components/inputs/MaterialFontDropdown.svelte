<script lang="ts">
    import { createEventDispatcher, onMount } from "svelte"
    import type { DropdownOptions } from "../../../types/Input"
    import { getFontStyleList, getSystemFontsList } from "../helpers/fonts"
    import MaterialDropdown from "./MaterialDropdown.svelte"
    import InputRow from "../input/InputRow.svelte"

    export let label: string
    export let value: string
    export let fontStyleValue: string = ""
    export let enableFontStyles: boolean = false
    export let allowEmpty: boolean = false

    let systemFontsList: DropdownOptions = []
    let fontsStylesList: DropdownOptions = []

    onMount(async () => {
        systemFontsList = await getSystemFontsList()
    })

    let defaultFontStyleValue = ""
    $: if (value && enableFontStyles) updateStyles()
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

    $: fontStylesVisible = enableFontStyles && value !== "CMGSans"
</script>

<InputRow style={$$props.style || ""}>
    <MaterialDropdown {label} options={systemFontsList} {value} style={fontStylesVisible ? "max-width: 80%;" : ""} on:change={change} {allowEmpty} />
    {#if fontStylesVisible}
        <MaterialDropdown label="settings.font_style" disabled={fontsStylesList.length < 2} options={fontsStylesList} value={fontStyleValue || defaultFontStyleValue} on:change={styleChange} onlyArrow />
    {/if}
</InputRow>
