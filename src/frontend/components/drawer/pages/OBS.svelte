<script lang="ts">
    import { onMount } from "svelte"
    import { obsData } from "../../../stores"
    import { connectToOBS } from "../../../utils/obsTalk"
    import Icon from "../../helpers/Icon.svelte"
    import MaterialButton from "../../inputs/MaterialButton.svelte"
    import MaterialTextInput from "../../inputs/MaterialTextInput.svelte"
    import MaterialNumberInput from "../../inputs/MaterialNumberInput.svelte"
    import Center from "../../system/Center.svelte"
    import T from "../../helpers/T.svelte"
    import Link from "../../inputs/Link.svelte"

    export let searchValue: string
    console.log(searchValue)

    let connected = false
    let scenes: string[] = []
    let currentScene: string = ""
    let isLive: boolean = false
    let isRecording: boolean = false
    let obs: any = null
    let errorMsg: string = ""
    let sources: any[] = []
    let transitions: string[] = []
    let currentTransition: string = ""
    let audioInputs: any[] = []

    let showSettings = false
    let ip = $obsData.ip || "localhost"
    let port = $obsData.port || 4455

    $: if (ip || port) {
        obsData.update((d) => ({ ...d, ip, port }))
    }

    $: if (connected && obs) {
        obs.call("GetSceneTransitionList")
        obs.call("GetInputList")
    }

    $: if (connected && currentScene && obs) {
        obs.call("GetSceneItemList", { sceneName: currentScene })
    }

    onMount(() => {
        // if connected previously, try to reconnect
        if ($obsData.connected) connect()
    })

    async function connect() {
        errorMsg = ""
        obs = await connectToOBS()

        if (obs.isConnected) connected = true

        obs.onStateChange((isConnected: boolean, error?: any) => {
            connected = isConnected
            errorMsg = ""
            if (!isConnected && error) {
                errorMsg = error
            }
            if (isConnected) {
                obs.call("GetSceneList")
                obs.call("GetStreamStatus")
                obs.call("GetRecordStatus")
            }
        })

        obs.listen((msg: any) => {
            // OpCode 7: Request Responses
            if (msg.op === 7 && msg.d) {
                const res = msg.d.responseData
                switch (msg.d.requestType) {
                    case "GetSceneList":
                        scenes = (res?.scenes || [])
                            .slice()
                            .sort((a: any, b: any) => b.sceneIndex - a.sceneIndex)
                            .map((s: any) => s.sceneName)
                        currentScene = res?.currentProgramSceneName || ""
                        break
                    case "GetStreamStatus":
                        isLive = Boolean(res?.outputActive)
                        break
                    case "GetRecordStatus":
                        isRecording = Boolean(res?.isRecording ?? res?.outputActive ?? false)
                        break
                    case "GetSceneItemList":
                        sources = (res?.sceneItems || []).slice().sort((a: any, b: any) => b.sceneItemIndex - a.sceneItemIndex)
                        obs.call("GetInputList")
                        break
                    case "GetSceneTransitionList":
                        transitions = (res?.transitions || []).map((t: any) => t.transitionName)
                        currentTransition = res?.currentSceneTransitionName || ""
                        break
                    case "GetInputList":
                        handleInputListResponse(res)
                        break
                    case "GetInputMute":
                        handleInputMuteResponse(msg.d)
                        break
                    case "ToggleRecord":
                        if (res && typeof res.outputActive !== "undefined") isRecording = res.outputActive
                        break
                }
            }

            // OpCode 5: Event Broadcasters
            if (msg.op === 5 && msg.d) {
                const evt = msg.d.eventData
                switch (msg.d.eventType) {
                    case "CurrentProgramSceneChanged":
                        currentScene = evt.sceneName
                        break
                    case "StreamStateChanged":
                        isLive = evt.outputActive
                        break
                    case "RecordStateChanged":
                        isRecording = evt.outputActive
                        break
                    case "SceneItemEnableStateChanged":
                        if (evt.sceneName === currentScene) {
                            sources = sources.map((s) => (s.sceneItemId === evt.sceneItemId ? { ...s, sceneItemEnabled: evt.sceneItemEnabled } : s))
                        }
                        break
                    case "SceneItemCreated":
                    case "SceneItemRemoved":
                        if (evt.sceneName === currentScene) obs.call("GetSceneItemList", { sceneName: currentScene })
                        break
                    case "CurrentSceneTransitionChanged":
                        currentTransition = evt.transitionName
                        break
                    case "InputMuteStateChanged":
                        audioInputs = audioInputs.map((input) => (input.inputName === evt.inputName ? { ...input, inputMuted: evt.inputMuted } : input))
                        break
                }
            }
        })
    }

    function handleInputListResponse(res: any) {
        const enabledSceneSourceNames = sources.filter((s: any) => s.sceneItemEnabled).map((s: any) => s.sourceName)
        const candidateInputs = (res?.inputs || []).filter((input: any) => {
            const kind = (input.inputKind || "").toLowerCase()
            const name = input.inputName || ""
            if (kind.includes("image") || kind.includes("color") || kind.includes("text") || kind.includes("cut")) return false
            if (name.toLowerCase().includes("rtmp") || kind.includes("rtmp")) return false
            const isGlobal = kind.includes("wasapi") || kind.includes("audio") || kind.includes("mic")
            return isGlobal || enabledSceneSourceNames.includes(name)
        })

        audioInputs = candidateInputs.map((input: any) => ({ ...input, hasAudio: undefined }))
        candidateInputs.forEach((input: any) => {
            obs.send({
                op: 6,
                d: {
                    requestType: "GetInputMute",
                    requestId: `mute_${input.inputName}`,
                    requestData: { inputName: input.inputName }
                }
            })
        })
    }

    function handleInputMuteResponse(d: any) {
        const reqId = d.requestId || ""
        if (reqId.startsWith("mute_")) {
            const inputName = reqId.substring(5)
            const hasAudio = d.requestStatus?.result === true
            if (hasAudio) {
                audioInputs = audioInputs.map((input: any) => {
                    if (input.inputName === inputName) {
                        return { ...input, inputMuted: d.responseData.inputMuted, hasAudio: true }
                    }
                    return input
                })
            } else {
                audioInputs = audioInputs.filter((input: any) => input.inputName !== inputName)
            }
        }
    }

    function changeScene(name: string) {
        if (obs) obs.call("SetCurrentProgramScene", { sceneName: name })
    }

    function toggleSource(source: any) {
        if (!obs) return
        const nextState = !source.sceneItemEnabled
        obs.call("SetSceneItemEnabled", {
            sceneName: currentScene,
            sceneItemId: source.sceneItemId,
            sceneItemEnabled: nextState
        })
        sources = sources.map((item: any) => (item.sceneItemId === source.sceneItemId ? { ...item, sceneItemEnabled: nextState } : item))
        setTimeout(() => {
            if (obs && currentScene) {
                obs.call("GetSceneItemList", { sceneName: currentScene })
                obs.call("GetInputList")
            }
        }, 300)
    }

    function changeTransition(name: string) {
        if (obs) {
            obs.call("SetCurrentSceneTransition", { transitionName: name })
            currentTransition = name
        }
    }

    function toggleMute(input: any) {
        if (obs) {
            obs.call("ToggleInputMute", { inputName: input.inputName })
            audioInputs = audioInputs.map((item: any) => (item.inputName === input.inputName ? { ...item, inputMuted: !item.inputMuted } : item))
        }
    }

    function toggleStream() {
        if (obs) obs.call("ToggleStream")
    }

    function toggleRecording() {
        if (obs) {
            obs.call("ToggleRecord")
            setTimeout(() => {
                obs.call("GetStreamStatus")
            }, 500)
        }
    }
</script>

{#if connected}
    <div class="obs-docks-container">
        <!-- Scenes List Dock -->
        <div class="obs-dock">
            <div class="obs-dock-header">
                <h4 class="obs-dock-title">Scenes</h4>
            </div>
            <ul class="obs-dock-list">
                {#each scenes as scene}
                    <li style="width: 100%;display: flex;justify-content: flex-start;">
                        <MaterialButton on:click={() => changeScene(scene)} id={scene === currentScene ? "active-scene-btn" : ""} class="obs-btn {scene === currentScene ? 'active-scene' : ''}">
                            {scene}
                        </MaterialButton>
                    </li>
                {/each}
            </ul>
        </div>

        <!-- Sources List Dock -->
        <div class="obs-dock">
            <div class="obs-dock-header">
                <h4 class="obs-dock-title">Sources</h4>
            </div>
            <ul class="obs-dock-list">
                {#each sources as source}
                    <li style="width: 100%;display: flex;justify-content: space-between;align-items: center;padding: 0.3em 0.7em;background: #2b303c;border-radius: 4px;">
                        <span style="color: {source.sceneItemEnabled ? '#f1f3f5' : '#64748b'};font-size: 0.85em;text-overflow: ellipsis;overflow: hidden;white-space: nowrap;max-width: 140px;" title={source.sourceName}>
                            {source.sourceName}
                        </span>
                        <MaterialButton on:click={() => toggleSource(source)} class="obs-btn-icon" title={source.sceneItemEnabled ? "Hide Layer" : "Show Layer"}>
                            <Icon id={source.sceneItemEnabled ? "eye" : "hide"} style="opacity: {source.sceneItemEnabled ? 1 : 0.35};" white />
                        </MaterialButton>
                    </li>
                {/each}
                {#if sources.length === 0}
                    <div style="padding: 1em;color: #555;font-size: 0.8em;text-align: center;">No Sources</div>
                {/if}
            </ul>
        </div>

        <!-- Audio Mixer Dock -->
        <div class="obs-dock">
            <div class="obs-dock-header">
                <h4 class="obs-dock-title">Audio Mixer</h4>
            </div>
            <ul class="obs-dock-list">
                {#each audioInputs.filter((input) => input.hasAudio) as input}
                    <li style="width: 100%;display: flex;justify-content: space-between;align-items: center;padding: 0.3em 0.7em;background: #2b303c;border-radius: 4px;">
                        <span style="color: {input.inputMuted ? '#64748b' : '#f1f3f5'};font-size: 0.85em;text-overflow: ellipsis;overflow: hidden;white-space: nowrap;max-width: 140px;" title={input.inputName}>
                            {input.inputName}
                        </span>
                        <MaterialButton on:click={() => toggleMute(input)} class="obs-btn-icon" title={input.inputMuted ? "Unmute" : "Mute"}>
                            <Icon id={input.inputMuted ? "volume_off" : "volume"} style="opacity: {input.inputMuted ? 0.7 : 1};" color={input.inputMuted ? "red" : ""} white />
                        </MaterialButton>
                    </li>
                {/each}
                {#if audioInputs.filter((input) => input.hasAudio).length === 0}
                    <div style="padding: 1em;color: #555;font-size: 0.8em;text-align: center;">No Audio</div>
                {/if}
            </ul>
        </div>

        <!-- Scene Transitions Dock -->
        <div class="obs-dock">
            <div class="obs-dock-header">
                <h4 class="obs-dock-title">Scene Transitions</h4>
            </div>
            <ul class="obs-dock-list">
                {#each transitions as transition}
                    <li style="width: 100%;display: flex;justify-content: flex-start;">
                        <MaterialButton on:click={() => changeTransition(transition)} id={transition === currentTransition ? "active-transition-btn" : ""} class="obs-btn {transition === currentTransition ? 'active-scene' : ''}">
                            {transition}
                        </MaterialButton>
                    </li>
                {/each}
            </ul>
        </div>

        <!-- Controls Dock -->
        <div class="obs-dock">
            <div class="obs-dock-header">
                <h4 class="obs-dock-title">Controls</h4>
            </div>
            <div class="obs-dock-body">
                <div class="obs-dock-row">
                    <MaterialButton on:click={toggleStream} class="obs-btn obs-btn-control {isLive ? 'obs-btn-success' : ''}">
                        {isLive ? "Stop Streaming" : "Start Streaming"}
                    </MaterialButton>
                </div>
                <div class="obs-dock-row">
                    <MaterialButton on:click={toggleRecording} class="obs-btn obs-btn-control {isRecording ? 'obs-btn-danger' : ''}">
                        {isRecording ? "Stop Recording" : "Start Recording"}
                    </MaterialButton>
                </div>
            </div>
        </div>
    </div>
{:else}
    <Center>
        <Link url="https://freeshow.app/docs/livestreaming#setting-up-obs-control-from-freeshow">
            <T id="main.docs" />
            <Icon id="launch" white />
        </Link>

        {#if errorMsg}
            <div style="margin-top: 20px;color: #ef4444;background: rgba(239, 68, 68, 0.1);border: 1px solid rgba(239, 68, 68, 0.2);padding: 0.75em 1.25em;border-radius: 6px;font-size: 0.9em;font-weight: 500;max-width: 340px;">
                {errorMsg}
            </div>
        {/if}

        <MaterialButton variant="outlined" on:click={connect} style="margin-top: 20px;width: 100%;max-width: 250px;">
            <Icon id="bind" white />
            <T id="settings.connect_to" replace={["OBS Studio"]} />
        </MaterialButton>

        <MaterialButton on:click={() => (showSettings = !showSettings)} style="padding: 0.5em;font-size: 0.85em;border: none;font-weight: normal;margin-top: 0.5em;opacity: 0.7;">
            <Icon id="options" style="opacity: 0.7;" white />
            <T id="edit.options" />
        </MaterialButton>

        {#if showSettings}
            <div style="display: flex; flex-direction: column; background: #2b303c; border-radius: 6px; width: 100%; max-width: 320px;">
                <MaterialTextInput label="IP" value={ip} placeholder="localhost" on:change={(e) => (ip = e.detail)} />
                <MaterialNumberInput label="settings.port" value={port} placeholder="4455" on:change={(e) => (port = e.detail)} />
            </div>
        {/if}
    </Center>
{/if}

<style>
    .obs-docks-container {
        display: flex;
        flex-direction: row;
        flex-wrap: nowrap;
        align-items: stretch;
        gap: 4px;
        margin: 6px;
        height: calc(100% - 12px);
        font-family: "Segoe UI", system-ui, sans-serif;
    }
    .obs-dock {
        background: #1f232a;
        border-radius: 6px;
        padding: 0;
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    }
    .obs-dock-header {
        width: 100%;
        background: #2b303c;
        font-size: 0.9em;
        border-top-left-radius: 5px;
        border-top-right-radius: 5px;
        padding: 0.3em 0.7em;
        display: flex;
        align-items: center;
    }
    .obs-dock-title {
        color: #f1f3f5;
        margin: 0;
        font-size: 0.9em;
        font-weight: 600;
        letter-spacing: 0.02em;
        opacity: 0.9;
    }
    .obs-dock-list {
        list-style: none;
        padding: 0.5em;
        margin: 0;
        display: flex;
        flex-direction: column;
        align-items: stretch;
        gap: 0.3em;
        flex: 1;
        overflow-y: auto;
    }
    .obs-dock-body {
        padding: 0.5em;
        display: flex;
        flex-direction: column;
        gap: 0.3em;
        flex: 1;
        justify-content: flex-start;
    }
    .obs-dock-row {
        display: flex;
        align-items: center;
        gap: 0.5em;
        width: 100%;
    }
    :global(.obs-btn-icon) {
        width: auto !important;
        padding: 0.3em 0.5em !important;
        justify-content: center !important;
        text-align: center !important;
        background: #2b303c !important;
        border-radius: 4px !important;
        box-shadow: none !important;
        transition:
            background-color 0.2s,
            border-color 0.2s !important;
    }
    :global(.obs-btn-icon:hover) {
        background-color: #3d4454 !important;
        border-color: #4c5468 !important;
    }

    :global(.obs-btn) {
        width: 100% !important;
        text-align: left !important;
        border-radius: 4px !important;
        box-shadow: none !important;
        justify-content: flex-start !important;
        padding: 0.5em 0.7em !important;
        font-size: 0.9em !important;
        font-weight: normal !important;
        background: #2b303c !important;
        border: 1px solid #101216 !important;
        border-color: transparent !important;
        color: #cbd5e1 !important;
        transition:
            background-color 0.2s,
            border-color 0.2s,
            color 0.2s !important;
    }
    :global(.obs-btn-control) {
        justify-content: center !important;
        text-align: center !important;
        padding: 0.75em 1.2em !important;
        font-weight: normal !important;
        color: white !important;
    }
    :global(.obs-docks-container .obs-dock .obs-dock-list .obs-btn.active-scene) {
        background-color: #2072ec !important;
        background: #2072ec !important;
        border-color: #2072ec !important;
        color: white !important;
    }
    :global(.obs-docks-container .obs-dock .obs-dock-list .obs-btn.active-scene:hover) {
        background-color: #3b82f6 !important;
        background: #3b82f6 !important;
        border-color: #3b82f6 !important;
    }
    :global(.obs-btn-success) {
        background: #22c55e !important;
        border-color: #16a34a !important;
    }
    :global(.obs-btn-danger) {
        background: #ef4444 !important;
        border-color: #dc2626 !important;
    }
    :global(.obs-btn:not(.active-scene):hover) {
        background-color: #3d4454 !important;
        border-color: #4c5468 !important;
        color: white !important;
    }
    :global(.obs-btn-success:hover) {
        background-color: #34d399 !important;
        border-color: #10b981 !important;
    }
    :global(.obs-btn-danger:hover) {
        background-color: #f87171 !important;
        border-color: #ef4444 !important;
    }
</style>
