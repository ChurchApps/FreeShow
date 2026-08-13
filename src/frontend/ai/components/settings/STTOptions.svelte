<script lang="ts">
    import { Main } from "../../../../types/IPC/Main"
    import type { EngineStatus } from "../../../../types/ai/AiModels"
    import { requestMain } from "../../../IPC/main"
    import { AudioMicrophone } from "../../../audio/audioMicrophone"
    import InputRow from "../../../components/input/InputRow.svelte"
    import Title from "../../../components/input/Title.svelte"
    import MaterialButton from "../../../components/inputs/MaterialButton.svelte"
    import MaterialDropdown from "../../../components/inputs/MaterialDropdown.svelte"
    import { activePopup, ai } from "../../../stores"

    $: options = $ai.stt || {}

    function updateValue(key: string, value: any) {
        ai.update((a) => {
            if (!a.stt) a.stt = {}
            a.stt[key] = value

            return a
        })
    }

    // STATUS

    let status: EngineStatus | null = null
    $: if (selectedEngine) getStatus()
    async function getStatus() {
        const result = await requestMain(Main.AI_GET_STATUS, { engineId: selectedEngine })
        status = result?.[selectedEngine] || null

        if (status?.ready) getMicrophones()
    }

    // MICS

    let microphones: { value: string; label: string }[] = []
    function getMicrophones() {
        AudioMicrophone.getList().then((devices) => {
            microphones = devices.map((device) => ({ value: device.deviceId, label: device.label }))

            // auto select a mic
            if (!options.micDeviceId && devices.length) {
                const defaultDevice = devices.find((device) => device.deviceId === "default")
                updateValue("micDeviceId", defaultDevice?.deviceId || devices[0].deviceId)
            }
        })
    }

    const engineOptions = [
        { value: "whisper", label: "Whisper" },
        { value: "nemotron", label: "Nemotron" }
    ]
    $: selectedEngine = options.engine || engineOptions[0].value
</script>

<Title label="ai.transcription" icon="microphone" />

<InputRow>
    <MaterialDropdown label="ai.engine" options={engineOptions} value={selectedEngine} disabled />
    <MaterialButton title="titlebar.edit" icon="edit" on:click={() => activePopup.set("ai_model_manager")} />
</InputRow>

{#if status?.ready}
    <MaterialDropdown label="midi.input" options={microphones} value={options.micDeviceId || ""} on:change={(e) => updateValue("micDeviceId", e.detail)} />
{/if}
