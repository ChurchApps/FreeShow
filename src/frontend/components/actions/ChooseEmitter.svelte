<script lang="ts">
    import { createEventDispatcher } from "svelte"
    import { emitters } from "../../stores"
    import { translateText } from "../../utils/language"
    import { clone } from "../helpers/array"
    import T from "../helpers/T.svelte"
    import DynamicList from "../input/DynamicList.svelte"
    import InputRow from "../input/InputRow.svelte"
    import { initDropdownOptions } from "../input/inputs"
    import MaterialDropdown from "../inputs/MaterialDropdown.svelte"
    import MaterialTextInput from "../inputs/MaterialTextInput.svelte"
    import { API_emitter } from "./api"
    import { formatData } from "./emitters"
    import MidiValues from "./MidiValues.svelte"

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
        } else if (key === "data") {
            v = v.detail
        }

        value[key] = v
        dispatch("change", value)
    }

    function setTemplateValue(index: string | number, e: any, key = "value") {
        let v = e.detail

        if (!value.templateValues) value.templateValues = clone(emitter?.templates?.[v]?.inputs || [])

        let templateValues = value.templateValues || []
        if (!templateValues[index]) templateValues[index] = { name: "", value: "" }
        templateValues[index][key] = v
        updateValue("templateValues", templateValues)
    }
    function setMidiTemplateValue(e: any) {
        let values = e.detail?.values

        let templateValues = value.templateValues || []
        if (!templateValues[0]) templateValues[0] = { name: "", value: "" }
        templateValues[0].value = values
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
    $: templatesList = [{ value: "custom", label: "actions.custom_key" }, ...initDropdownOptions(emitter?.templates || {})]
    $: templateInputs = (emitter?.templates?.[activeTemplate]?.inputs || []).filter((a) => emitter?.type === "midi" || a.name)

    $: customTemplateInputs = (value.templateValues || []).map((a, i) => ({ ...a, id: i.toString() }))

    $: dataPreview = value.templateValues?.length ? formatData[emitter?.type]?.(value.templateValues, value.data) : ""
</script>

<MaterialDropdown
    label="emitters.emitter <span style='color: var(--text);opacity: 0.5;font-weight: normal;font-size: 0.8em;margin-left: 10px;'>[{emitter.type}]</span>"
    options={emittersList}
    value={value.emitter}
    on:change={(e) => updateValue("emitter", e.detail)}
/>

{#if value.emitter}
    {#if emitter?.description}
        <InputRow>
            <p><T id="midi.description" /></p>
            <p style="opacity: 0.5;overflow: hidden;" data-title={emitter.description}>{emitter.description}</p>
        </InputRow>
    {/if}

    <MaterialDropdown label="emitters.message_template" options={templatesList} value={activeTemplate} on:click={(e) => updateValue("template", e.detail)} />

    {#if templateInputs.length}
        {#if emitter?.templates?.[activeTemplate]?.description}
            <InputRow>
                <p><T id="midi.description" /></p>
                <p style="opacity: 0.5;overflow: hidden;" data-title={emitter.templates[activeTemplate].description}>{emitter.templates[activeTemplate].description}</p>
            </InputRow>
        {/if}

        {#if emitter?.type !== "midi"}
            {#each templateInputs as input, i}
                <MaterialTextInput
                    label={input.name}
                    disabled={!!input.value}
                    placeholder={translateText("variables.value")}
                    value={typeof (value.templateValues?.[i] || input).value === "string" ? (value.templateValues?.[i] || input).value : ""}
                    on:change={(e) => setTemplateValue(i, e)}
                />
            {/each}
        {/if}
    {:else if emitter?.type === "midi"}
        <MidiValues value={{ ...emitter.signal, values: typeof customTemplateInputs[0]?.value === "object" ? customTemplateInputs[0].value : {} }} on:change={(e) => setMidiTemplateValue(e)} type="emitter" />
    {:else}
        <DynamicList
            addDisabled={!!customTemplateInputs?.find((a) => !a.name && !a.value)}
            items={customTemplateInputs}
            let:item={input}
            on:add={createTemplateValue}
            on:delete={(e) => removeTemplateValue(e.detail)}
            allowOpen={false}
            nothingText={false}
        >
            <div style="display: flex;width: 100%;">
                <MaterialTextInput label="inputs.name" value={input.name} on:change={(e) => setTemplateValue(input.id, e, "name")} style="width: 50%;" />
                <MaterialTextInput label="variables.value" value={input.value} on:change={(e) => setTemplateValue(input.id, e, "value")} style="width: 50%;" />
            </div>
        </DynamicList>
    {/if}

    <!-- extra DATA -->
    {#if emitter?.type === "osc"}
        <MaterialTextInput label="emitters.data" value={value.data || ""} on:change={(e) => updateValue("data", e)} />
    {/if}

    <InputRow>
        <p><T id="timer.preview" /></p>
        <p style="opacity: 0.5;overflow: hidden;" data-title={dataPreview}>{dataPreview}</p>
    </InputRow>
{/if}
