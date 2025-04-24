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
    import { requestMain } from "../../../IPC/main"
    import { Main } from "../../../../types/IPC/Main"
    import MidiValues from "../../actions/MidiValues.svelte"

    $: emittersList = sortByName(sortByName(keysToID($emitters)), "type")

    let editEmitter = ""
    $: emitter = $emitters[editEmitter]

    let editTemplate = ""
    $: template = emitter?.templates?.[editTemplate]
    $: templateInputs = (template?.inputs || []).map((a, i) => ({ ...a, id: i.toString() }))
    $: dataPreview = templateInputs.length ? formatData[emitter?.type]?.(setEmptyValues(templateInputs)) : ""
    function setEmptyValues(object) {
        return clone(object).map((a) => ({ ...a, value: a.value || (a.name ? `{${a.name.toLowerCase()}}` : "") }))
    }

    $: emitterTypes = [
        { name: "OSC", id: "osc" },
        { name: "HTTP", id: "http" },
        { name: "MIDI", id: "midi" },
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

    function updateMidiTemplateValue(e: any) {
        let values = e.detail?.values

        let templates = emitter?.templates || {}
        if (!templates[editTemplate]?.inputs?.[0]) createTemplateValue()

        templates[editTemplate].inputs[0] = { name: "", value: values }
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
        if (input.type === "dropdown" && typeof input.value === "object") input.value = input.value.id

        let previousValue = emitter[key]
        if (typeof previousValue !== "object") previousValue = {}

        let newValue = { ...previousValue, [input.id]: input.value }
        if (!input.id) newValue = input.value
        updateValue(key, newValue)
    }

    $: signalInputs = editEmitter && emitter ? clone(getValues(emitterData[emitter.type]?.signal || [], emitter.signal)) : []

    // MIDI

    $: if (emitter?.type === "midi") getMidiOutputs()
    function getMidiOutputs() {
        if (signalInputs[0].type !== "dropdown" || signalInputs[0].options[0]?.id) return

        requestMain(Main.GET_MIDI_OUTPUTS, undefined, (data) => {
            if (!data.length || signalInputs[0].type !== "dropdown") return

            signalInputs[0].options = data.map((a) => ({ id: a.name, ...a }))
            if (!emitter?.signal?.output) updateValue("signal", { output: data[0].name })
            // if (!signalInputs[0].value) signalInputs[0].value = data[0].name
        })
    }
</script>

{#if editTemplate && template}
    <Button class="popup-back" title={$dictionary.actions?.back} on:click={() => (editTemplate = "")}>
        <Icon id="back" size={2} white />
    </Button>

    <CombinedInput textWidth={30}>
        <p><T id="midi.name" /></p>
        <TextInput value={template.name} on:change={(e) => updateTemplate("name", e)} autofocus={!template.name} />
    </CombinedInput>

    <HRule title="emitters.inputs" />

    {#if emitter.type === "midi"}
        <MidiValues value={{ ...emitter.signal, values: typeof templateInputs[0]?.value === "object" ? templateInputs[0].value : {} }} on:change={(e) => updateMidiTemplateValue(e)} type="emitter" />
    {:else}
        <DynamicList addDisabled={!!templateInputs.find((a) => !a.name && !a.value)} items={templateInputs} let:item={input} on:add={createTemplateValue} on:delete={(e) => removeTemplateValue(e.detail)} allowOpen={false}>
            <div style="display: flex;width: 100%;">
                <TextInput placeholder={$dictionary.inputs?.name} value={input.name} on:change={(e) => updateTemplateValue(input.id, "name", e)} style="width: 50%;" />
                <TextInput placeholder={$dictionary.variables?.value} value={input.value} on:change={(e) => updateTemplateValue(input.id, "value", e)} />
            </div>
        </DynamicList>
    {/if}

    {#if dataPreview}
        <div class="preview">
            {dataPreview}
        </div>
    {/if}
{:else if editEmitter && emitter}
    <Button class="popup-back" title={$dictionary.actions?.back} on:click={() => (editEmitter = "")}>
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
