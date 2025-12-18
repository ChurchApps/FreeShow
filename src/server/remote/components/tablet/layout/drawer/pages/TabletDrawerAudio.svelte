<script lang="ts">
    import { onMount } from "svelte"
    import { send } from "../../../../../util/socket"
    import { dictionary, mixer } from "../../../../../util/stores"
    import { translate } from "../../../../../util/helpers"
    import Icon from "../../../../../../common/components/Icon.svelte"
    import AudioChannel from "./AudioChannel.svelte"

    let outputsExpanded = false
    let dragging: Record<string, boolean> = {}
    let localVolumes: Record<string, number> = {}
    let lastUpdate: Record<string, number> = {}

    onMount(() => send("GET_MIXER"))

    $: mainData = $mixer?.main || {}
    $: outputs = ($mixer?.outputs || {}) as Record<string, { name?: string; volume?: number; isMuted?: boolean }>

    function getVolume(id: string, storeVolume?: number): number {
        return dragging[id] ? (localVolumes[id] ?? storeVolume ?? 1) : (storeVolume ?? 1)
    }

    function sendVolume(id: string, value: number) {
        if (id === "main") send("SET_VOLUME", { volume: value })
        else send("SET_OUTPUT_VOLUME", { id, volume: value })
    }

    function handleInput(id: string, value: number) {
        localVolumes = { ...localVolumes, [id]: value }
        dragging = { ...dragging, [id]: true }

        const now = Date.now()
        if (!lastUpdate[id] || now - lastUpdate[id] > 50) {
            sendVolume(id, value)
            lastUpdate[id] = now
        }
    }

    function handleChange(id: string, value: number) {
        localVolumes = { ...localVolumes, [id]: value }
        dragging = { ...dragging, [id]: false }
        sendVolume(id, value)
    }

    function toggleMute(id: string) {
        const isMuted = id === "main" ? mainData.isMuted : outputs[id]?.isMuted
        if (id === "main") send("TOGGLE_MUTE", { muted: !isMuted })
        else send("TOGGLE_OUTPUT_MUTE", { id, muted: !isMuted })
    }
</script>

<div class="mixer-container">
    <AudioChannel label={translate("audio.main", $dictionary)} volume={getVolume("main", mainData.volume)} isMuted={mainData.isMuted ?? false} on:input={(e) => handleInput("main", e.detail)} on:change={(e) => handleChange("main", e.detail)} on:mute={() => toggleMute("main")} />

    {#if Object.keys(outputs).length > 0}
        <button class="outputs-header" type="button" on:click={() => (outputsExpanded = !outputsExpanded)}>
            <div class="outputs-title">
                <Icon id="display_settings" size={1} />
                <span>{translate("settings.display_settings", $dictionary)}</span>
            </div>
            <Icon id="expand" class="outputs-arrow {outputsExpanded ? 'open' : ''}" size={1} white />
        </button>

        {#if outputsExpanded}
            {#each Object.entries(outputs) as [id, output]}
                <AudioChannel label={output.name || id} volume={getVolume(id, output.volume)} isMuted={output.isMuted ?? false} on:input={(e) => handleInput(id, e.detail)} on:change={(e) => handleChange(id, e.detail)} on:mute={() => toggleMute(id)} />
            {/each}
        {/if}
    {/if}
</div>

<style>
    .mixer-container {
        padding: 10px;
        background-color: var(--primary-darkest);
        height: 100%;
        overflow-y: auto;
    }

    .outputs-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        padding: 8px 12px;

        background-color: var(--primary-darker);
        border-bottom: 1px solid var(--primary-lighter);
        border-top-left-radius: 10px;
        border-top-right-radius: 10px;

        width: 100%;
        border: none;
        color: inherit;
        font: inherit;
        text-align: left;
        cursor: pointer;

        margin-top: 10px;
    }

    .outputs-title {
        display: flex;
        align-items: center;
        gap: 8px;

        font-weight: 500;
        font-size: 0.8rem;
        opacity: 0.8;
    }

    .outputs-header :global(svg.outputs-arrow) {
        transition: 0.2s transform ease;
        transform: rotate(0deg);
        opacity: 0.5;
    }
    .outputs-header :global(svg.outputs-arrow.open) {
        transform: rotate(180deg);
    }
</style>
