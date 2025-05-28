<script lang="ts">
    import { createEventDispatcher } from "svelte"
    import { outputs, styles } from "../../../stores"
    import T from "../../helpers/T.svelte"
    import { keysToID, sortByName } from "../../helpers/array"
    import CombinedInput from "../../inputs/CombinedInput.svelte"
    import Dropdown from "../../inputs/Dropdown.svelte"
    import type { API_output_style } from "../api"
    import { newToast } from "../../../utils/common"

    export let value: API_output_style

    let styleId: string = value.outputStyle || ""
    $: if (!Object.keys($styles).length) newToast("$toast.empty_styles")

    let styleOutputs = value.styleOutputs || { type: "active" }
    $: currentStyle = $styles[styleId] || {}

    let outputsOptions = [
        { id: "active", name: "$:actions.active_outputs:$" },
        { id: "all", name: "$:actions.all_outputs:$" },
        { id: "specific", name: "$:actions.specific_outputs:$" }
    ]
    let outputsList = getList($outputs).filter((a) => !a.isKeyOutput && !a.stageOutput)
    let stylesList = getList($styles)

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

<CombinedInput>
    <p><T id="settings.display_settings" /></p>
    <Dropdown value={outputsOptions.find((a) => a.id === styleOutputs.type)?.name || ""} options={outputsOptions} on:click={(e) => updateStyle("styleOutputs", { type: e.detail.id, outputs: styleOutputs.outputs || {} })} />
</CombinedInput>

{#if styleOutputs.type === "specific"}
    {#each outputsList as output}
        <CombinedInput>
            <p>{output.name}</p>
            <Dropdown value={stylesList.find((a) => a.id === styleOutputs.outputs[output.id])?.name || "—"} options={[{ id: "", name: "—" }, ...stylesList]} on:click={(e) => setOutputStyle(output.id, e.detail.id)} />
        </CombinedInput>
    {/each}
{:else}
    <CombinedInput>
        <p><T id="edit.style" /></p>
        <Dropdown value={currentStyle?.name || "—"} options={stylesList} on:click={(e) => updateStyle("outputStyle", e.detail.id)} />
    </CombinedInput>
{/if}
