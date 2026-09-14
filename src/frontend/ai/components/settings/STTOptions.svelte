<script lang="ts">
    import { Main } from "../../../../types/IPC/Main"
    import type { EngineStatus } from "../../../../types/ai/Ai"
    import { requestMain } from "../../../IPC/main"
    import { AudioMicrophone } from "../../../audio/audioMicrophone"
    import Title from "../../../components/input/Title.svelte"
    import MaterialDropdown from "../../../components/inputs/MaterialDropdown.svelte"
    import Tip from "../../../components/main/Tip.svelte"
    import { ai, mediaDownloads } from "../../../stores"
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

    // update status every time a download finishes
    let downloadingCount = 0
    $: currentlyDownloading = $mediaDownloads
    $: if (!status?.ready && currentlyDownloading) {
        if (currentlyDownloading.size < downloadingCount) getStatus()
        downloadingCount = currentlyDownloading.size
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

    // const sttEngines = {
    //     nemotron: { label: "Nemotron" }
    // }
    $: selectedEngine = $ai.stt?.engine || resolveSttEngine()
</script>

<Title label="ai.transcription" icon="microphone" />

<!-- Currently not needed as there's just one engine -->
<!-- <InputRow>
    <MaterialButton
        title="titlebar.edit"
        icon="edit"
        style="width: 100%;"
        on:click={() => {
            popupData.set({ mode: "transcription" })
            activePopup.set("ai_model_manager")
        }}
    >
        <T id="ai.engine" />: <span style="font-weight: bold;">{sttEngines[selectedEngine]?.label}</span>
    </MaterialButton>
</InputRow> -->

{#if status?.ready}
    <MaterialDropdown label="midi.input" options={microphones} value={options.micDeviceId || ""} on:change={(e) => updateValue("micDeviceId", e.detail)} />
{:else}
    <Tip type="warning" value={status?.error || "No model available."} />
{/if}
