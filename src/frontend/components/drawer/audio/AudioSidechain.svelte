<script lang="ts">
    import { gainToDb, MIN_DB } from "../../../audio/dBUtils"
    import { channelSidechainMultipliers } from "../../../stores"
    import { translateText } from "../../../utils/language"

    export let channelId: string

    $: sidechainMultiplier = $channelSidechainMultipliers[channelId] ?? 1.0
    // Gain reduction in dB (e.g., 0 dB when sidechainMultiplier = 1.0, 12 dB when multiplier ~ 0.25)
    $: reductionDb = sidechainMultiplier >= 0.999 ? 0 : Math.min(-MIN_DB, Math.max(0, -gainToDb(sidechainMultiplier)))
    // Match the dB scale of AudioMeter (-60 dB to 0 dB, so width = (reductionDb / 60) * 100)
    $: reductionPct = (reductionDb / -MIN_DB) * 100

    const MAX_REDUCTION_DB = -48
</script>

<div class="sidechain-reduction-track" data-title="{translateText('audio.sidechain')}: -{reductionDb.toFixed(1)} dB">
    <div class="sidechain-reduction-bar" style="width: {reductionPct}%;"></div>
    <div class="sidechain-reduction-max" style="right: {(MAX_REDUCTION_DB / MIN_DB) * 100}%;"></div>
</div>

<style>
    .sidechain-reduction-track {
        position: relative;
        width: 100%;
        height: 3px;
        background-color: rgba(255, 255, 255, 0.06);
        border-radius: 2px;
        overflow: hidden;

        /* signal dot spacing */
        margin-left: 5px;
        width: calc(100% - 5px);
    }

    .sidechain-reduction-max {
        position: absolute;
        top: 0;
        height: 100%;
        width: 2px;
        transform: translateX(50%);

        background-color: white;
        opacity: 0.12;
    }

    .sidechain-reduction-bar {
        position: absolute;
        right: 0;
        top: 0;
        bottom: 0;
        background-color: #f59e0b;
        border-radius: 2px;
        transition: width 0.08s ease-out;
    }

    @keyframes sidechain-pulse {
        from {
            transform: scale(0.9);
            opacity: 0.7;
        }
        to {
            transform: scale(1);
            opacity: 1;
        }
    }
</style>
