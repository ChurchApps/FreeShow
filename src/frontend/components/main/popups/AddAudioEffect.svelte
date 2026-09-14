<script lang="ts">
    import { get } from "svelte/store"
    import { addEffectToStack, EFFECTS_LIST, type EffectType } from "../../../audio/effects/audioEffectsHelpers"
    import { activeAudioEffects, activePopup, popupData } from "../../../stores"
    import { translateText } from "../../../utils/language"
    import MaterialButton from "../../inputs/MaterialButton.svelte"

    let channelId = $popupData?.channelId || get(activeAudioEffects) || "main"

    function selectEffect(effectKey: EffectType) {
        const newInstance = addEffectToStack(effectKey, channelId)
        popupData.set({ channelId, effectId: newInstance.id, effect: effectKey })
        activePopup.set("audio_effect")
    }
</script>

<div style="display: flex;flex-direction: column;gap: 2px;">
    {#each EFFECTS_LIST as eff}
        <MaterialButton variant="outlined" style="border-left: 4px solid {eff.color};padding: 8px 12px;font-weight: normal;font-size: 0.75em;justify-content: left;" title={eff.description} on:click={() => selectEffect(eff.id)}>
            {translateText(eff.label)}
        </MaterialButton>
    {/each}
</div>
