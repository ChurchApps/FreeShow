<script lang="ts">
    import { outputs, popupData, styles } from "../../../stores"
    import T from "../../helpers/T.svelte"
    import { clone } from "../../helpers/array"
    import { history } from "../../helpers/history"
    import { _show } from "../../helpers/shows"
    import CombinedInput from "../../inputs/CombinedInput.svelte"
    import Dropdown from "../../inputs/Dropdown.svelte"

    let currentStyleId = $popupData.id
    let styleOutputs = $popupData.outputs || { type: "active" }
    $: currentStyle = $styles[currentStyleId]

    let outputsOptions = [
        { id: "active", name: "$:actions.active_outputs:$" },
        { id: "all", name: "$:actions.all_outputs:$" },
        { id: "specific", name: "$:actions.specific_outputs:$" },
    ]
    let outputsList = getList($outputs).filter((a) => !a.isKeyOutput)
    let stylesList = getList($styles)

    function getList(styles) {
        let list = Object.entries(styles).map(([id, obj]: any) => {
            return { ...obj, id }
        })

        return list.sort((a, b) => a.name.localeCompare(b.name))
    }

    function updateStyle(key: string, value: any) {
        let ref = _show().layouts("active").ref()[0]
        let actions = clone(ref[$popupData.indexes[0]]?.data?.actions) || {}

        actions[key] = value

        history({ id: "SHOW_LAYOUT", newData: { key: "actions", data: actions, indexes: $popupData.indexes }, location: { page: "show", override: "change_style_slide_" + key } })

        if (key === "outputStyle") currentStyleId = value
        else styleOutputs = value
    }

    function setOutputStyle(outputId: string, styleId: string) {
        let newOutputs = styleOutputs.outputs || {}

        newOutputs[outputId] = styleId
        if (!styleId) delete newOutputs[outputId]

        updateStyle("styleOutputs", { type: "specific", outputs: newOutputs })
    }
</script>

<CombinedInput>
    <p><T id="settings.outputs" /></p>
    <Dropdown value={outputsOptions.find((a) => a.id === styleOutputs.type)?.name || ""} options={outputsOptions} on:click={(e) => updateStyle("styleOutputs", { type: e.detail.id, outputs: styleOutputs.outputs || {} })} />
</CombinedInput>

<br />

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
        <Dropdown value={currentStyle.name} options={stylesList} on:click={(e) => updateStyle("outputStyle", e.detail.id)} />
    </CombinedInput>
{/if}
