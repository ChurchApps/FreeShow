<script lang="ts">
    import { resetAudioRouting } from "../../../audio/routing/audioRoutingInit"
    import { audioRouting } from "../../../stores"
    import T from "../../helpers/T.svelte"
    import MaterialButton from "../../inputs/MaterialButton.svelte"
    import MaterialToggleSwitch from "../../inputs/MaterialToggleSwitch.svelte"

    function toggleMultichannel(enabled: boolean) {
        audioRouting.update((a) => (a ? { ...a, showMultichannel: enabled } : a))
    }
</script>

<MaterialToggleSwitch label="audio.multi_channel" checked={!!$audioRouting?.showMultichannel} defaultValue={false} on:change={(e) => toggleMultichannel(e.detail)} />

<MaterialButton variant="outlined" title="audio.reset_routing" icon="reset" style="width: 100%;margin-top: 10px;" on:click={resetAudioRouting}>
    <T id="audio.reset_routing" />
</MaterialButton>
