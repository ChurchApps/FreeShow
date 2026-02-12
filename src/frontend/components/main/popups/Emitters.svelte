<script lang="ts">
    import { uid } from "uid"
    import { Main } from "../../../../types/IPC/Main"
    import type { Emitter, EmitterTemplate, EmitterTemplateValue } from "../../../../types/Show"
    import { requestMain } from "../../../IPC/main"
    import { activePopup, emitters, popupData } from "../../../stores"
    import { emitterData, formatData } from "../../actions/emitters"
    import MidiValues from "../../actions/MidiValues.svelte"
    import { clone, keysToID, sortByName } from "../../helpers/array"
    import T from "../../helpers/T.svelte"
    import DynamicList from "../../input/DynamicList.svelte"
    import HRule from "../../input/HRule.svelte"
    import { getValues } from "../../input/inputs"
    import Inputs from "../../input/Inputs.svelte"
    import MaterialButton from "../../inputs/MaterialButton.svelte"
    import MaterialDropdown from "../../inputs/MaterialDropdown.svelte"
    import MaterialTextInput from "../../inputs/MaterialTextInput.svelte"

    $: emittersList = sortByName(sortByName(keysToID($emitters)), "type")

    let editEmitter = ""
    $: emitter = $emitters[editEmitter]

    let editTemplate = ""
    $: template = emitter?.templates?.[editTemplate]
    $: templateInputs = (template?.inputs || []).map((a, i) => ({ ...a, id: i.toString() }))
    $: dataPreview = templateInputs.length ? formatData[emitter?.type]?.(setEmptyValues(templateInputs), emitter.data) : ""
    function setEmptyValues(object) {
        return clone(object).map((a) => ({ ...a, value: a.value || (a.name ? `{${a.name.toLowerCase()}}` : "") }))
    }

    const emitterTypes = [
        { value: "osc", label: "OSC" },
        { value: "http", label: "HTTP" },
        { value: "midi", label: "MIDI" }
    ]

    const DEFAULT_EMITTER: Emitter = { name: "", type: "osc" }
    const DEFAULT_TEMPLATE: EmitterTemplate = { name: "", inputs: [] }
    const DEFAULT_TEMPLATE_VALUE: EmitterTemplateValue = { name: "", value: "" }

    // create from action dropdown
    const createId = $popupData?.id || ""
    const createName = $popupData?.name || ""
    const backData = $popupData?.actionData || null
    if (createName) {
        createEmitter()
        updateValue("name", createName)
    } else if (createId) {
        editEmitter = createId
    }

    function createEmitter() {
        let id = createId || uid()
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
        let value = e.detail
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
        let value = e.detail
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

    function updateValue(key: keyof Emitter, value: any) {
        if (!editEmitter || !$emitters[editEmitter]) return

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

    // MIDI

    $: if (emitter?.type === "midi") getMidiOutputs()
    function getMidiOutputs() {
        if (signalInputs[0].type !== "dropdown" || signalInputs[0].options[0]?.value) return

        requestMain(Main.GET_MIDI_OUTPUTS, undefined, (data) => {
            if (!data.length || signalInputs[0].type !== "dropdown") return

            signalInputs[0].options = data.map((a) => ({ value: a.name, label: a.name, ...a }))
            if (!emitter?.signal?.output) updateValue("signal", { output: data[0].name })
            // if (!signalInputs[0].value) signalInputs[0].value = data[0].name
        })
    }
</script>

{#if backData}
    <MaterialButton
        class="popup-back"
        icon="back"
        iconSize={1.3}
        title="actions.back"
        on:click={() => {
            popupData.set(backData)
            activePopup.set("action")
        }}
    />
{/if}

{#if editTemplate && template}
    <MaterialButton class="popup-back" icon="back" iconSize={1.3} title="actions.back" on:click={() => (editTemplate = "")} />

    <MaterialTextInput label="midi.name" value={template.name} on:change={(e) => updateTemplate("name", e)} autofocus={!template.name} />
    <MaterialTextInput label="midi.description" value={template.description || ""} on:change={(e) => updateTemplate("description", e)} />

    <HRule title="emitters.inputs" />

    {#if emitter.type === "midi"}
        <MidiValues value={{ ...emitter.signal, values: typeof templateInputs[0]?.value === "object" ? templateInputs[0].value : {} }} on:change={(e) => updateMidiTemplateValue(e)} type="emitter" />
    {:else}
        <DynamicList addDisabled={!!templateInputs.find((a) => !a.name && !a.value)} items={templateInputs} let:item={input} on:add={createTemplateValue} on:delete={(e) => removeTemplateValue(e.detail)} allowOpen={false}>
            <div style="display: flex;width: 100%;">
                <MaterialTextInput label="inputs.name" value={input.name} on:change={(e) => updateTemplateValue(input.id, "name", e)} style="width: 50%;" />
                <MaterialTextInput label="variables.value" value={input.value} on:change={(e) => updateTemplateValue(input.id, "value", e)} style="width: 50%;" />
            </div>
        </DynamicList>
    {/if}

    {#if dataPreview}
        <div class="preview">
            {dataPreview}
        </div>
    {/if}
{:else if editEmitter && emitter}
    {#if !backData}
        <MaterialButton class="popup-back" icon="back" iconSize={1.3} title="actions.back" on:click={() => (editEmitter = "")} />
    {/if}

    <MaterialTextInput label="midi.name" value={emitter.name} on:change={(e) => updateValue("name", e.detail)} autofocus={!emitter.name} />
    <MaterialTextInput label="midi.description" value={emitter.description || ""} on:change={(e) => updateValue("description", e.detail)} />

    <MaterialDropdown label="midi.type" disabled={!!Object.keys(emitter.templates || {})?.length} options={emitterTypes} value={emitter.type} on:change={(e) => updateValue("type", e.detail)} />

    <Inputs inputs={signalInputs} title="emitters.signal" on:change={(e) => changed(e, "signal")} />

    <!-- TEMPLATES: -->
    <!-- WIP message templates only working for OSC/HTTP - MIDI should have a custom template... -->
    <HRule title="emitters.message_templates" />

    <DynamicList items={keysToID(emitter.templates || {})} let:item={template} on:open={(e) => (editTemplate = e.detail)} on:delete={(e) => deleteTemplate(e.detail)} on:add={createTemplate}>
        <p class="template" style="display: flex;gap: 5px;width: 100%;min-width: auto;">
            {template.name || "—"} <span style="display: flex;align-items: center;margin-left: 10px;font-size: 0.8em;opacity: 0.5;font-style: italic;">{template.description || ""}</span>
        </p>
    </DynamicList>
{:else}
    {#if !emittersList.length}
        <p style="opacity: 0.8;font-size: 0.8em;text-align: center;margin-bottom: 20px;"><T id="emitters.tip" /></p>
    {/if}

    <DynamicList items={emittersList} let:item={emitter} on:open={(e) => (editEmitter = e.detail)} on:delete={(e) => deleteEmitter(e.detail)} on:add={createEmitter}>
        <p class="emitter" style="display: flex;gap: 5px;width: 100%;min-width: auto;">
            <span style="display: flex;align-items: center;text-transform: uppercase;opacity: 0.5;min-width: 50px;">{emitter.type}</span>{emitter.name || "—"}
            <span style="display: flex;align-items: center;margin-left: 10px;font-size: 0.8em;opacity: 0.5;font-style: italic;">{emitter.description || ""}</span>
        </p>
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
