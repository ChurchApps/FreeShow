<script lang="ts">
    import { uid } from "uid"
    import type { Emitter, EmitterTemplate, EmitterTemplateValue } from "../../../../types/Show"
    import { dictionary, emitters } from "../../../stores"
    import { emitterData, formatData } from "../../actions/emitters"
    import { clone, keysToID, sortByName } from "../../helpers/array"
    import Icon from "../../helpers/Icon.svelte"
    import T from "../../helpers/T.svelte"
    import DynamicList from "../../input/DynamicList.svelte"
    import { getValues } from "../../input/inputs"
    import Inputs from "../../input/Inputs.svelte"
    import Button from "../../inputs/Button.svelte"
    import CombinedInput from "../../inputs/CombinedInput.svelte"
    import Dropdown from "../../inputs/Dropdown.svelte"
    import TextInput from "../../inputs/TextInput.svelte"
    import HRule from "../../input/HRule.svelte"

    $: emittersList = sortByName(sortByName(keysToID($emitters)), "type")

    let editEmitter: string = ""
    $: emitter = $emitters[editEmitter]

    let editTemplate: string = ""
    $: template = emitter?.templates?.[editTemplate]
    $: templateInputs = (template?.inputs || []).map((a, i) => ({ ...a, id: i.toString() }))
    $: dataPreview = templateInputs.length ? formatData[emitter?.type]?.(templateInputs) : ""

    $: emitterTypes = [
        { name: "OSC", id: "osc" },
        { name: "HTTP", id: "http" },
        // { name: "MIDI", id: "midi" },
    ]

    const DEFAULT_EMITTER: Emitter = { name: "", type: "osc" }
    const DEFAULT_TEMPLATE: EmitterTemplate = { name: "", inputs: [] }
    const DEFAULT_TEMPLATE_VALUE: EmitterTemplateValue = { name: "", value: "" }

    function createEmitter() {
        let id = uid()
        emitters.update((a) => {
            a[id] = clone(DEFAULT_EMITTER)
            return a
        })

        editEmitter = id
    }
    function deleteEmitter(id: string) {
        emitters.update((a) => {
            delete a[id]
            return a
        })
    }

    function createTemplate() {
        let id = uid()
        let templates = emitter?.templates || {}
        templates[id] = clone(DEFAULT_TEMPLATE)
        updateValue("templates", templates)

        editTemplate = id
    }
    function deleteTemplate(id: string) {
        let templates = emitter?.templates || {}
        if (!templates[id]) return

        delete templates[id]
        updateValue("templates", templates)
    }
    function updateTemplate(key: string, e: any) {
        let value = e.target?.value
        let templates = emitter?.templates || {}
        if (!templates[editTemplate]) return

        templates[editTemplate][key] = value
        updateValue("templates", templates)
    }

    function createTemplateValue() {
        let templates = emitter?.templates || {}
        if (!templates[editTemplate]) return

        if (!templates[editTemplate].inputs) templates[editTemplate].inputs = []
        templates[editTemplate].inputs.push(clone(DEFAULT_TEMPLATE_VALUE))

        updateValue("templates", templates)
    }
    function removeTemplateValue(index: string) {
        let templates = emitter?.templates || {}
        if (!templates[editTemplate]?.inputs) return

        templates[editTemplate].inputs.splice(Number(index), 1)

        updateValue("templates", templates)
    }
    function updateTemplateValue(index: string, key: string, e: any) {
        let value = e.target?.value
        let templates = emitter?.templates || {}
        if (!templates[editTemplate]?.inputs?.[index]) return

        templates[editTemplate].inputs[index][key] = value
        updateValue("templates", templates)
    }

    function updateValue(key: keyof Emitter, e: any) {
        if (!editEmitter || !$emitters[editEmitter]) return

        let value = e.target?.value ?? e

        emitters.update((a) => {
            a[editEmitter][key] = value
            return a
        })
    }

    function changed(e: any, key: keyof Emitter) {
        let input = e.detail

        let previousValue = emitter[key]
        if (typeof previousValue !== "object") previousValue = {}

        let newValue = { ...previousValue, [input.id]: input.value }
        if (!input.id) newValue = input.value
        updateValue(key, newValue)
    }

    $: signalInputs = editEmitter && emitter ? clone(getValues(emitterData[emitter.type]?.signal || [], emitter.signal)) : []
</script>

{#if editTemplate && template}
    <Button style="position: absolute;left: 0;top: 0;min-height: 58px;" title={$dictionary.actions?.back} on:click={() => (editTemplate = "")}>
        <Icon id="back" size={2} white />
    </Button>

    <CombinedInput textWidth={30}>
        <p><T id="midi.name" /></p>
        <TextInput value={template.name} on:change={(e) => updateTemplate("name", e)} autofocus={!template.name} />
    </CombinedInput>

    <HRule title="emitters.inputs" />

    <DynamicList addDisabled={!!templateInputs.find((a) => !a.name && !a.value)} items={templateInputs} let:item={input} on:add={createTemplateValue} on:delete={(e) => removeTemplateValue(e.detail)} allowOpen={false}>
        <div style="display: flex;width: 100%;">
            <TextInput placeholder={$dictionary.inputs?.name} value={input.name} on:change={(e) => updateTemplateValue(input.id, "name", e)} style="width: 50%;" />
            <TextInput placeholder={$dictionary.variables?.value} value={input.value} on:change={(e) => updateTemplateValue(input.id, "value", e)} />
        </div>
    </DynamicList>

    {#if dataPreview}
        <div class="preview">
            {dataPreview}
        </div>
    {/if}
{:else if editEmitter && emitter}
    <Button style="position: absolute;left: 0;top: 0;min-height: 58px;" title={$dictionary.actions?.back} on:click={() => (editEmitter = "")}>
        <Icon id="back" size={2} white />
    </Button>

    <CombinedInput textWidth={30}>
        <p><T id="midi.name" /></p>
        <TextInput value={emitter.name} on:change={(e) => updateValue("name", e)} autofocus={!emitter.name} />
    </CombinedInput>

    <CombinedInput textWidth={30}>
        <p><T id="midi.type" /></p>
        <Dropdown disabled={!!Object.keys(emitter.templates || {})?.length} options={emitterTypes} value={emitterTypes.find((a) => a.id === emitter.type)?.name || "—"} on:click={(e) => updateValue("type", e.detail.id)} />
    </CombinedInput>

    <Inputs inputs={signalInputs} title="emitters.signal" on:change={(e) => changed(e, "signal")} />

    <!-- TEMPLATES: -->
    <!-- WIP message templates only working for OSC/HTTP - MIDI should have a custom template... -->
    <HRule title="emitters.message_templates" />

    <DynamicList items={keysToID(emitter.templates || {})} let:item={template} on:open={(e) => (editTemplate = e.detail)} on:delete={(e) => deleteTemplate(e.detail)} on:add={createTemplate}>
        <p class="template" style="gap: 5px;width: 100%;min-width: auto;">{template.name || "—"}</p>
    </DynamicList>
{:else}
    {#if !emittersList.length}
        <p style="opacity: 0.8;font-size: 0.8em;text-align: center;margin-bottom: 20px;"><T id="emitters.tip" /></p>
    {/if}

    <DynamicList items={emittersList} let:item={emitter} on:open={(e) => (editEmitter = e.detail)} on:delete={(e) => deleteEmitter(e.detail)} on:add={createEmitter}>
        <p class="emitter" style="gap: 5px;width: 100%;min-width: auto;"><span style="display: flex;align-items: center;text-transform: uppercase;opacity: 0.7;">[{emitter.type}]</span>{emitter.name || "—"}</p>
    </DynamicList>
{/if}

<style>
    .preview {
        text-align: center;
        font-size: 0.9em;
        opacity: 0.8;
        padding-top: 12px;
    }
</style>
