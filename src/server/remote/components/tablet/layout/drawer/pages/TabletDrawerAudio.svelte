<script lang="ts">
    import { onMount } from "svelte"
    import Center from "../../../../../../common/components/Center.svelte"
    import Icon from "../../../../../../common/components/Icon.svelte"
    import { dbToGain, formatDb, gainToDb, gainToSlider, MAX_DB, MIN_DB, sliderToGain } from "../../../../../../common/util/dBUtils"
    import { translate } from "../../../../../util/helpers"
    import { send } from "../../../../../util/socket"
    import { audioChannelsData, audioRouting, dictionary } from "../../../../../util/stores"
    import MaterialButton from "../../../../MaterialButton.svelte"

    onMount(() => {
        send("GET_AUDIO_MIXER")
    })

    $: channels = $audioRouting?.channels || [{ id: "main", name: translate("audio.main", $dictionary, "Main") }]

    function updateVolume(channelId: string, gain: number) {
        send("API:change_volume", { channelId, volume: gain })
    }

    function toggleMute(channelId: string, currentMuted: boolean) {
        send("API:mute", { id: channelId, value: !currentMuted })
    }

    function onSliderInput(channelId: string, e: Event) {
        const target = e.target as HTMLInputElement
        const sliderPos = parseFloat(target.value) || 0
        let gain = sliderToGain(sliderPos)
        // Snap to unity (0 dB / 1.0 gain) near 0.8 position
        if (sliderPos >= 0.78 && sliderPos <= 0.82) gain = 1.0
        updateVolume(channelId, gain)
    }

    function adjustDb(channelId: string, currentGain: number, delta: number) {
        let currentDb = gainToDb(currentGain)
        if (currentDb === -Infinity || currentDb < MIN_DB) currentDb = MIN_DB
        const newDb = Math.max(MIN_DB, Math.min(MAX_DB, currentDb + delta))
        const gain = dbToGain(newDb)
        updateVolume(channelId, gain)
    }
</script>

<div class="audio-mixer-page">
    {#if channels.length}
        <div class="channels-list">
            {#each channels as channel (channel.id)}
                {@const channelData = $audioChannelsData[channel.id] || {}}
                {@const rawVolume = Number(channelData.volume ?? 1)}
                {@const volumeValue = rawVolume > 5 ? rawVolume / 100 : rawVolume}
                {@const sliderPosition = gainToSlider(volumeValue)}
                {@const isMuted = !!channelData.isMuted}
                {@const color = channel.color || "var(--secondary)"}

                <div class="channel-card" style="--channel-color: {color};">
                    <div class="channel-header">
                        <div class="channel-title">
                            <span class="color-dot" style="background-color: {color};"></span>
                            <span class="name" title={channel.name || channel.id}>{channel.name || channel.id}</span>
                        </div>
                        <span class="db-badge" class:unity={Math.abs(volumeValue - 1.0) < 0.01}>
                            {formatDb(volumeValue)}
                        </span>
                    </div>

                    <div class="channel-controls">
                        <!-- Step Down Button -->
                        <button class="step-btn" type="button" title="-1 dB" on:click={() => adjustDb(channel.id, volumeValue, -1)}>
                            <Icon id="remove" size={1} white />
                        </button>

                        <!-- Fader Slider -->
                        <div class="slider-wrapper">
                            <input type="range" class="volume-slider" min="0" max="1" step="0.005" value={sliderPosition} on:input={(e) => onSliderInput(channel.id, e)} />
                        </div>

                        <!-- Step Up Button -->
                        <button class="step-btn" type="button" title="+1 dB" on:click={() => adjustDb(channel.id, volumeValue, 1)}>
                            <Icon id="add" size={1} white />
                        </button>

                        <!-- Mute / Unmute Button -->
                        <MaterialButton variant="outlined" style="padding: 6px 10px; min-height: 36px;" icon={isMuted ? "muted" : "volume"} title={isMuted ? translate("actions.unmute", $dictionary, "Unmute") : translate("actions.mute", $dictionary, "Mute")} red={isMuted} on:click={() => toggleMute(channel.id, isMuted)} />
                    </div>
                </div>
            {/each}
        </div>
    {:else}
        <Center faded>
            <p>{translate("empty.general", $dictionary, "No audio channels available")}</p>
        </Center>
    {/if}
</div>

<style>
    .audio-mixer-page {
        display: flex;
        flex-direction: column;
        flex: 1;
        overflow-y: auto;
        padding: 12px;
        background-color: var(--primary-darkest);
    }

    .channels-list {
        display: flex;
        flex-direction: column;
        gap: 10px;
        width: 100%;
        max-width: 800px;
        margin: 0 auto;
    }

    .channel-card {
        display: flex;
        flex-direction: column;
        gap: 8px;
        padding: 10px 14px;
        background-color: rgb(0 0 0 / 0.2);
        border: 1px solid var(--primary-lighter);
        border-radius: 8px;
    }

    .channel-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
    }

    .channel-title {
        display: flex;
        align-items: center;
        gap: 8px;
        overflow: hidden;
    }

    .color-dot {
        width: 10px;
        height: 10px;
        border-radius: 50%;
        flex-shrink: 0;
    }

    .name {
        font-weight: 600;
        font-size: 0.95em;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        color: var(--text);
    }

    .db-badge {
        font-size: 0.85em;
        font-weight: 600;
        color: var(--channel-color, var(--secondary));
        background: rgb(0 0 0 / 0.25);
        padding: 2px 8px;
        border-radius: 4px;
        font-family: monospace;
        letter-spacing: 0.5px;
    }

    .db-badge.unity {
        color: var(--text);
        opacity: 0.9;
    }

    .channel-controls {
        display: flex;
        align-items: center;
        gap: 8px;
        width: 100%;
    }

    .slider-wrapper {
        flex: 1;
        display: flex;
        align-items: center;
    }

    .volume-slider {
        -webkit-appearance: none;
        appearance: none;
        width: 100%;
        height: 8px;
        background: var(--primary-darker);
        border-radius: 4px;
        outline: none;
        transition: opacity 0.2s;
    }

    .volume-slider::-webkit-slider-thumb {
        -webkit-appearance: none;
        appearance: none;
        width: 18px;
        height: 18px;
        border-radius: 50%;
        background: var(--channel-color, var(--secondary));
        cursor: pointer;
        border: 2px solid var(--primary-darkest);
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.4);
        transition: transform 0.1s ease;
    }

    .volume-slider::-webkit-slider-thumb:active {
        transform: scale(1.2);
    }

    .volume-slider::-moz-range-thumb {
        width: 18px;
        height: 18px;
        border-radius: 50%;
        background: var(--channel-color, var(--secondary));
        cursor: pointer;
        border: 2px solid var(--primary-darkest);
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.4);
    }

    .step-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 32px;
        height: 32px;
        border-radius: 6px;
        border: 1px solid var(--primary-lighter);
        background: var(--primary-darker);
        color: var(--text);
        cursor: pointer;
        padding: 0;
        flex-shrink: 0;
        transition: background 0.15s ease;
    }

    .step-btn:hover {
        background: rgb(255 255 255 / 0.1);
    }

    .step-btn:active {
        background: rgb(255 255 255 / 0.2);
    }
</style>
