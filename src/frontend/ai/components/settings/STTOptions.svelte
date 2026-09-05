<script lang="ts">
    import { Main } from "../../../../types/IPC/Main"
    import type { EngineStatus } from "../../../../types/ai/Ai"
    import { requestMain } from "../../../IPC/main"
    import { AudioMicrophone } from "../../../audio/audioMicrophone"
    import InputRow from "../../../components/input/InputRow.svelte"
    import Title from "../../../components/input/Title.svelte"
    import MaterialButton from "../../../components/inputs/MaterialButton.svelte"
    import MaterialDropdown from "../../../components/inputs/MaterialDropdown.svelte"
    import { activePopup, ai } from "../../../stores"
    import { resolveSttEngine, SpeechToText } from "../../stt/stt"

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
        AudioMicrophone.getList().then(async (devices) => {
            microphones = devices.map((device) => ({ value: device.deviceId, label: device.label }))

            // auto select the SYSTEM default input (the first listed device can be e.g. a continuity iPhone)
            if (!options.micDeviceId && devices.length) {
                const deviceId = await SpeechToText.resolveMicDeviceId("")
                if (deviceId) updateValue("micDeviceId", deviceId)
            }
        })
    }

    const engineOptions = [
        { value: "nemotron", label: "Nemotron" },
        { value: "whisper", label: "Whisper" }
    ]
    $: selectedEngine = $ai.stt?.engine || resolveSttEngine()
</script>

<Title label="ai.transcription" icon="microphone" />

<InputRow>
    <MaterialDropdown label="ai.engine" options={engineOptions} value={selectedEngine} disabled />
    <MaterialButton title="titlebar.edit" icon="edit" on:click={() => activePopup.set("ai_model_manager")} />
</InputRow>

{#if status?.ready}
    <MaterialDropdown label="midi.input" options={microphones} value={options.micDeviceId || ""} on:change={(e) => updateValue("micDeviceId", e.detail)} />
{/if}
