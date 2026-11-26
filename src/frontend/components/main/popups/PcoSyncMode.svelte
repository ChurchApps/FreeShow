<script lang="ts">
    import { contentProviderData } from "../../../stores"
    import { startFirstPcoSync } from "../../../utils/pcoConnect"
    import { getProviderOriginOptions } from "../../../utils/providerOriginOptions"
    import T from "../../helpers/T.svelte"
    import MaterialButton from "../../inputs/MaterialButton.svelte"

    const options = getProviderOriginOptions(true)
    $: current = $contentProviderData.planningcenter?.songOrigin || ""
</script>

<p><T id="settings.pco_sync_mode_tip" /></p>

<div class="options">
    {#each options as option}
        <MaterialButton variant="outlined" isActive={option.value === current} style="justify-content: start;" on:click={() => startFirstPcoSync(option.value)}>
            <span class="option">
                <b>{option.label}</b>
                <span class="description">{option.data}</span>
            </span>
        </MaterialButton>
    {/each}
</div>

<style>
    p {
        margin-bottom: 15px;
    }

    .options {
        display: flex;
        flex-direction: column;
        gap: 6px;
    }

    .option {
        display: flex;
        flex-direction: column;
        align-items: start;
        gap: 2px;
    }

    .description {
        font-size: 0.8em;
        opacity: 0.7;
    }
</style>
