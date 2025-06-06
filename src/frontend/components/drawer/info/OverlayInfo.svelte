<script lang="ts">
    import { drawerTabsData } from "../../../stores"
    import { setExampleOverlays } from "../../../utils/createData"
    import Icon from "../../helpers/Icon.svelte"
    import T from "../../helpers/T.svelte"
    import Button from "../../inputs/Button.svelte"
    import EffectsInfo from "./EffectsInfo.svelte"

    $: subTab = $drawerTabsData.media?.activeSubTab
</script>

{#if subTab === "effects"}
    <EffectsInfo />
{:else}
    <div class="scroll" />

    <Button style="width: 100%;" on:click={setExampleOverlays} center dark>
        <Icon id="reset" right />
        <T id="actions.reset_defaults" />
    </Button>
{/if}

<style>
    .scroll {
        display: flex;
        flex-direction: column;
        flex: 1;
        overflow-y: auto;
        overflow-x: hidden;
    }
</style>
