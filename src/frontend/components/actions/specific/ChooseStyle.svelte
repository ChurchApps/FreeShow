<script lang="ts">
    import { createEventDispatcher } from "svelte"
    import { outputs, styles } from "../../../stores"
    import { newToast } from "../../../utils/common"
    import { translateText } from "../../../utils/language"
    import { keysToID, sortByName } from "../../helpers/array"
    import MaterialDropdown from "../../inputs/MaterialDropdown.svelte"
    import type { API_output_style } from "../api"

    export let value: API_output_style

    let styleId: string = value.outputStyle || ""
    $: if (!Object.keys($styles).length) newToast("toast.empty_styles")

    let styleOutputs = value.styleOutputs || { type: "active" }

    let outputsOptions = [
        { value: "active", label: translateText("actions.active_outputs") },
        { value: "all", label: translateText("actions.all_outputs") },
        { value: "specific", label: translateText("actions.specific_outputs") }
    ]
    let outputsList = getList($outputs).filter(a => !a.stageOutput)
    let stylesList = getList($styles).map(a => ({ value: a.id, label: a.name }))

    function getList(list) {
        return sortByName(keysToID(list))
    }

    let dispatch = createEventDispatcher()
    function updateStyle(key: string, newValue: any) {
        value[key] = newValue

        if (key === "outputStyle") styleId = newValue
        else styleOutputs = newValue

        dispatch("change", value)
    }

    function setOutputStyle(outputId: string, styleId: string) {
        let newOutputs = styleOutputs.outputs || {}

        newOutputs[outputId] = styleId
        if (!styleId) delete newOutputs[outputId]

        updateStyle("styleOutputs", { type: "specific", outputs: newOutputs })
    }
</script>

<MaterialDropdown label="settings.display_settings" options={outputsOptions} value={styleOutputs.type} on:change={e => updateStyle("styleOutputs", { type: e.detail, outputs: styleOutputs.outputs || {} })} />

{#if styleOutputs.type === "specific"}
    {#each outputsList as output}
        <MaterialDropdown label={output.name} options={stylesList} value={styleOutputs.outputs[output.id]} on:change={e => setOutputStyle(output.id, e.detail)} allowEmpty />
    {/each}
{:else}
    <MaterialDropdown label="edit.style" options={stylesList} value={styleId} on:change={e => updateStyle("outputStyle", e.detail)} allowEmpty />
{/if}
