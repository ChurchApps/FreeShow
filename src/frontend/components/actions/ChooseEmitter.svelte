<script lang="ts">
    import { createEventDispatcher } from "svelte"
    import { dictionary, emitters } from "../../stores"
    import { getDropdownValue, initDropdownOptions } from "../input/inputs"
    import { API_emitter } from "./api"
    import Dropdown from "../inputs/Dropdown.svelte"
    import T from "../helpers/T.svelte"
    import CombinedInput from "../inputs/CombinedInput.svelte"
    import DynamicList from "../input/DynamicList.svelte"
    import TextInput from "../inputs/TextInput.svelte"
    import { clone } from "../helpers/array"
    import { formatData } from "./emitters"

    export let value: API_emitter

    $: emittersList = initDropdownOptions($emitters)

    $: emitter = $emitters[value.emitter]

    let dispatch = createEventDispatcher()
    function updateValue(key: string, v: any) {
        if (key === "emitter") {
            value.templateValues = []
            value.template = ""
        } else if (key === "template") {
            let inputs = clone(emitter?.templates?.[v]?.inputs || [])
            value.templateValues = inputs
        }

        value[key] = v
        dispatch("change", value)
    }

    function setTemplateValue(index: string | number, e: any, key: string = "value") {
        let v = e.target?.value

        if (!value.templateValues) value.templateValues = clone(emitter?.templates?.[v]?.inputs || [])

        let templateValues = value.templateValues || []
        if (!templateValues[index]) templateValues[index] = { name: "", value: "" }
        templateValues[index][key] = v
        updateValue("templateValues", templateValues)
    }
    function createTemplateValue() {
        let templateValues = value.templateValues || []
        templateValues.push({ name: "", value: "" })
        updateValue("templateValues", templateValues)
    }
    function removeTemplateValue(index: string) {
        let templateValues = value.templateValues || []
        templateValues.slice(Number(index), 1)
        updateValue("templateValues", templateValues)
    }

    $: activeTemplate = value.template || "custom"
    $: templatesList = [{ name: "$:actions.custom_key:$", id: "custom" }, ...initDropdownOptions(emitter?.templates || {})]
    $: templateInputs = (emitter?.templates?.[activeTemplate]?.inputs || []).filter((a) => a.name)

    $: customTemplateInputs = (value.templateValues || []).map((a, i) => ({ ...a, id: i.toString() }))

    $: dataPreview = value.templateValues?.length ? formatData[emitter?.type]?.(value.templateValues) : ""
</script>

<CombinedInput textWidth={38}>
    <p><T id="emitters.emitter" /></p>
    <Dropdown options={emittersList} value={getDropdownValue(emittersList, value.emitter)} on:click={(e) => updateValue("emitter", e.detail.id)} />
</CombinedInput>

{#if value.emitter}
    <CombinedInput textWidth={38}>
        <p><T id="emitters.message_template" /></p>
        <Dropdown options={templatesList} value={getDropdownValue(templatesList, activeTemplate)} on:click={(e) => updateValue("template", e.detail.id)} />
    </CombinedInput>

    {#if templateInputs.length}
        {#each templateInputs as input, i}
            <CombinedInput textWidth={38}>
                <TextInput disabled value={input.name} style="width: var(--text-width);" />
                <TextInput disabled={!!input.value} placeholder={$dictionary.variables?.value} value={(value.templateValues?.[i] || input).value} on:change={(e) => setTemplateValue(i, e)} />
            </CombinedInput>
        {/each}
    {:else}
        <DynamicList
            addDisabled={!!customTemplateInputs?.find((a) => !a.name && !a.value)}
            items={customTemplateInputs}
            let:item={input}
            on:add={createTemplateValue}
            on:delete={(e) => removeTemplateValue(e.detail)}
            allowOpen={false}
            nothingText={false}
            textWidth={38}
        >
            <div style="display: flex;width: 100%;--text-width: calc(38% + 14px);">
                <TextInput placeholder={$dictionary.inputs?.name} value={input.name} on:change={(e) => setTemplateValue(input.id, e, "name")} style="width: var(--text-width);" />
                <TextInput placeholder={$dictionary.variables?.value} value={input.value} on:change={(e) => setTemplateValue(input.id, e, "value")} />
            </div>
        </DynamicList>
    {/if}

    <CombinedInput textWidth={38}>
        <p><T id="timer.preview" /></p>
        <p style="opacity: 0.5;overflow: hidden;" title={dataPreview}>{dataPreview}</p>
    </CombinedInput>
{/if}
