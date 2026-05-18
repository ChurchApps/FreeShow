<script>
    import { activeAudioEffects } from "../../../stores"
    import { translateText } from "../../../utils/language"
    import Icon from "../../helpers/Icon.svelte"
    import T from "../../helpers/T.svelte"
    import Button from "../../inputs/Button.svelte"
    import MaterialButton from "../../inputs/MaterialButton.svelte"
    import AudioCompressor from "./effects/AudioCompressor.svelte"
    import AudioDelay from "./effects/AudioDelay.svelte"
    import AudioEqualizer from "./effects/AudioEqualizer.svelte"
    import AudioFilter from "./effects/AudioFilter.svelte"
    import AudioLimiter from "./effects/AudioLimiter.svelte"
    import AudioNoiseGate from "./effects/AudioNoiseGate.svelte"
    import AudioReverb from "./effects/AudioReverb.svelte"
    import AudioStereoShaper from "./effects/AudioStereoShaper.svelte"

    let expanded = {}
    function toggleSection(type) {
        expanded[type] = !expanded[type]
    }

    function resetSection(type) {
        console.log("RESET", type)
        // WIP
    }

    // WIP
    $: hasChanged = {
        equalizer: false,
        filter: false,
        noiseGate: false,
        compressor: false,
        reverb: false,
        delay: false,
        limiter: false,
        stereoShaper: false
    }
</script>

<!-- header (go back) -->
<Button on:click={() => activeAudioEffects.set("")} center dark>
    <Icon id="back" right />
    <T id="actions.back" />
</Button>

<!-- name... -->
<!-- {#if $activeAudioEffects === "main"}
    {translateText("audio.main")}
{:else}
    {$outputs[$activeAudioEffects]?.name}
{/if} -->

<!-- EQ (Equalizer), compressor, and limiter -->

<div class="sections">
    <!-- Equalizer (EQ) -->
    <div class="section">
        <div class="title">
            <MaterialButton style="width: 100%;{hasChanged.equalizer ? 'padding: 4px 12px;' : 'padding: 8px 12px;'}" disabled={hasChanged.equalizer} on:click={() => toggleSection("equalizer")}>
                <span style="display: flex;gap: 8px;align-items: center;">
                    <p>{translateText("audio.equalizer")}</p>
                </span>

                {#if hasChanged.equalizer}
                    <MaterialButton title="actions.reset" style="pointer-events: all;padding: 4px;" on:click={() => resetSection("equalizer")}>
                        <Icon id="reset" size={0.8} white />
                    </MaterialButton>
                {:else}
                    <Icon id="arrow_back_modern" class="arrow {expanded['equalizer'] ? 'open' : ''}" size={0.6} style="opacity: 0.5;" white />
                {/if}
            </MaterialButton>
        </div>

        {#if expanded["equalizer"]}
            <AudioEqualizer />
        {/if}
    </div>

    <!-- Filter -->
    <div class="section">
        <div class="title">
            <MaterialButton style="width: 100%;{hasChanged.filter ? 'padding: 4px 12px;' : 'padding: 8px 12px;'}" disabled={hasChanged.filter} on:click={() => toggleSection("filter")}>
                <span style="display: flex;gap: 8px;align-items: center;">
                    <p>{translateText("audio.filter")}</p>
                </span>

                {#if hasChanged.filter}
                    <MaterialButton title="actions.reset" style="pointer-events: all;padding: 4px;" on:click={() => resetSection("filter")}>
                        <Icon id="reset" size={0.8} white />
                    </MaterialButton>
                {:else}
                    <Icon id="arrow_back_modern" class="arrow {expanded['filter'] ? 'open' : ''}" size={0.6} style="opacity: 0.5;" white />
                {/if}
            </MaterialButton>
        </div>

        {#if expanded["filter"]}
            <AudioFilter />
        {/if}
    </div>

    <!-- Noise Gate -->
    <div class="section">
        <div class="title">
            <MaterialButton style="width: 100%;{hasChanged.noiseGate ? 'padding: 4px 12px;' : 'padding: 8px 12px;'}" disabled={hasChanged.noiseGate} on:click={() => toggleSection("noiseGate")}>
                <span style="display: flex;gap: 8px;align-items: center;">
                    <p>{translateText("audio.gate")}</p>
                </span>

                {#if hasChanged.noiseGate}
                    <MaterialButton title="actions.reset" style="pointer-events: all;padding: 4px;" on:click={() => resetSection("noiseGate")}>
                        <Icon id="reset" size={0.8} white />
                    </MaterialButton>
                {:else}
                    <Icon id="arrow_back_modern" class="arrow {expanded['noiseGate'] ? 'open' : ''}" size={0.6} style="opacity: 0.5;" white />
                {/if}
            </MaterialButton>
        </div>

        {#if expanded["noiseGate"]}
            <AudioNoiseGate />
        {/if}
    </div>

    <!-- Compressor -->
    <div class="section">
        <div class="title">
            <MaterialButton style="width: 100%;{hasChanged.compressor ? 'padding: 4px 12px;' : 'padding: 8px 12px;'}" disabled={hasChanged.compressor} on:click={() => toggleSection("compressor")}>
                <span style="display: flex;gap: 8px;align-items: center;">
                    <p>{translateText("audio.compressor")}</p>
                </span>

                {#if hasChanged.compressor}
                    <MaterialButton title="actions.reset" style="pointer-events: all;padding: 4px;" on:click={() => resetSection("compressor")}>
                        <Icon id="reset" size={0.8} white />
                    </MaterialButton>
                {:else}
                    <Icon id="arrow_back_modern" class="arrow {expanded['compressor'] ? 'open' : ''}" size={0.6} style="opacity: 0.5;" white />
                {/if}
            </MaterialButton>
        </div>

        {#if expanded["compressor"]}
            <AudioCompressor />
        {/if}
    </div>

    <!-- Limiter -->
    <div class="section">
        <div class="title">
            <MaterialButton style="width: 100%;{hasChanged.limiter ? 'padding: 4px 12px;' : 'padding: 8px 12px;'}" disabled={hasChanged.limiter} on:click={() => toggleSection("limiter")}>
                <span style="display: flex;gap: 8px;align-items: center;">
                    <p>{translateText("audio.limiter")}</p>
                </span>

                {#if hasChanged.limiter}
                    <MaterialButton title="actions.reset" style="pointer-events: all;padding: 4px;" on:click={() => resetSection("limiter")}>
                        <Icon id="reset" size={0.8} white />
                    </MaterialButton>
                {:else}
                    <Icon id="arrow_back_modern" class="arrow {expanded['limiter'] ? 'open' : ''}" size={0.6} style="opacity: 0.5;" white />
                {/if}
            </MaterialButton>
        </div>

        {#if expanded["limiter"]}
            <AudioLimiter />
        {/if}
    </div>

    <!-- Reverb -->
    <div class="section">
        <div class="title">
            <MaterialButton style="width: 100%;{hasChanged.reverb ? 'padding: 4px 12px;' : 'padding: 8px 12px;'}" disabled={hasChanged.reverb} on:click={() => toggleSection("reverb")}>
                <span style="display: flex;gap: 8px;align-items: center;">
                    <p>{translateText("audio.reverb")}</p>
                </span>

                {#if hasChanged.reverb}
                    <MaterialButton title="actions.reset" style="pointer-events: all;padding: 4px;" on:click={() => resetSection("reverb")}>
                        <Icon id="reset" size={0.8} white />
                    </MaterialButton>
                {:else}
                    <Icon id="arrow_back_modern" class="arrow {expanded['reverb'] ? 'open' : ''}" size={0.6} style="opacity: 0.5;" white />
                {/if}
            </MaterialButton>
        </div>

        {#if expanded["reverb"]}
            <AudioReverb />
        {/if}
    </div>

    <!-- Delay -->
    <div class="section">
        <div class="title">
            <MaterialButton style="width: 100%;{hasChanged.delay ? 'padding: 4px 12px;' : 'padding: 8px 12px;'}" disabled={hasChanged.delay} on:click={() => toggleSection("delay")}>
                <span style="display: flex;gap: 8px;align-items: center;">
                    <p>{translateText("audio.delay")}</p>
                </span>

                {#if hasChanged.delay}
                    <MaterialButton title="actions.reset" style="pointer-events: all;padding: 4px;" on:click={() => resetSection("delay")}>
                        <Icon id="reset" size={0.8} white />
                    </MaterialButton>
                {:else}
                    <Icon id="arrow_back_modern" class="arrow {expanded['delay'] ? 'open' : ''}" size={0.6} style="opacity: 0.5;" white />
                {/if}
            </MaterialButton>
        </div>

        {#if expanded["delay"]}
            <AudioDelay />
        {/if}
    </div>

    <!-- Stereo Shaper -->
    <div class="section">
        <div class="title">
            <MaterialButton style="width: 100%;{hasChanged.stereoShaper ? 'padding: 4px 12px;' : 'padding: 8px 12px;'}" disabled={hasChanged.stereoShaper} on:click={() => toggleSection("stereoShaper")}>
                <span style="display: flex;gap: 8px;align-items: center;">
                    <p>{translateText("audio.stereo_shaper")}</p>
                </span>

                {#if hasChanged.stereoShaper}
                    <MaterialButton title="actions.reset" style="pointer-events: all;padding: 4px;" on:click={() => resetSection("stereoShaper")}>
                        <Icon id="reset" size={0.8} white />
                    </MaterialButton>
                {:else}
                    <Icon id="arrow_back_modern" class="arrow {expanded['stereoShaper'] ? 'open' : ''}" size={0.6} style="opacity: 0.5;" white />
                {/if}
            </MaterialButton>
        </div>

        {#if expanded["stereoShaper"]}
            <AudioStereoShaper />
        {/if}
    </div>
</div>

<style>
    .sections {
        display: flex;
        flex-direction: column;
        gap: 5px;
        padding: 10px;
    }

    .title {
        background-color: var(--primary-darker);
        border-bottom: 1px solid var(--primary-lighter);

        border-top-left-radius: 10px;
        border-top-right-radius: 10px;
        overflow: hidden;
    }
    .title p {
        font-weight: 500;
        font-size: 0.8rem;
        opacity: 0.8;
    }

    .title :global(button) {
        display: flex;
        justify-content: space-between;

        /* when disabled */
        opacity: 1;
    }

    .title :global(svg.arrow) {
        transition: 0.1s transform ease;
        transform: rotate(180deg);
    }
    .title :global(svg.arrow.open) {
        transform: rotate(-90deg);
    }
</style>
