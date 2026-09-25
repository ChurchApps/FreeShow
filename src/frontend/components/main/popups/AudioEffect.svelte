<script lang="ts">
    import { get } from "svelte/store"
    import type { EffectType } from "../../../audio/effects/audioEffectsHelpers"
    import { activeAudioEffects, popupData } from "../../../stores"
    import AudioCompressor from "../../drawer/audio/effects/AudioCompressor.svelte"
    import AudioDelay from "../../drawer/audio/effects/AudioDelay.svelte"
    import AudioEffectPresets from "../../drawer/audio/effects/AudioEffectPresets.svelte"
    import AudioEqualizer from "../../drawer/audio/effects/AudioEqualizer.svelte"
    import AudioFilter from "../../drawer/audio/effects/AudioFilter.svelte"
    import AudioLimiter from "../../drawer/audio/effects/AudioLimiter.svelte"
    import AudioNoiseGate from "../../drawer/audio/effects/AudioNoiseGate.svelte"
    import AudioReverb from "../../drawer/audio/effects/AudioReverb.svelte"
    import AudioStereoShaper from "../../drawer/audio/effects/AudioStereoShaper.svelte"
    import MaterialButton from "../../inputs/MaterialButton.svelte"

    const EFFECT_COMPONENTS: Record<string, any> = {
        equalizer: AudioEqualizer,
        filter: AudioFilter,
        noiseGate: AudioNoiseGate,
        compressor: AudioCompressor,
        reverb: AudioReverb,
        delay: AudioDelay,
        limiter: AudioLimiter,
        stereoShaper: AudioStereoShaper
    }

    let channelId = $popupData?.channelId || get(activeAudioEffects) || "main"
    let effectKey: EffectType = $popupData?.effect || "equalizer"
    let effectId: string = $popupData?.effectId || ""

    $: if (channelId && $activeAudioEffects !== channelId) {
        activeAudioEffects.set(channelId)
    }

    $: component = EFFECT_COMPONENTS[effectKey]

    let showMore = false
</script>

<MaterialButton class="popup-options {showMore ? 'active' : ''}" icon="options" iconSize={1.3} title={showMore ? "actions.close" : "create_show.more_options"} on:click={() => (showMore = !showMore)} white />

<div style="display: flex;flex-direction: column;width: calc(100vw - (var(--navigation-width) + 20px) * 2);">
    {#if showMore}
        <div style="margin-bottom: 10px;">
            <AudioEffectPresets {effectKey} {channelId} {effectId} />
        </div>
    {/if}

    {#key `${channelId}_${effectId || effectKey}`}
        {#if component}
            <svelte:component this={component} {effectId} {channelId} />
        {/if}
    {/key}
</div>
