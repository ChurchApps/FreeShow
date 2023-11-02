<script lang="ts">
    import { drawerTabsData } from "../../../stores"
    import { setExampleOverlays } from "../../../utils/createData"
    import Icon from "../../helpers/Icon.svelte"
    import T from "../../helpers/T.svelte"
    import Button from "../../inputs/Button.svelte"

    let type: string = "overlays"
    $: type = $drawerTabsData.overlays?.activeSubTab || "overlays"
</script>

{#if type === "variables"}
    <!-- VARIABLE -->
{:else if type === "triggers"}
    <div class="scroll" style="padding: 10px;">
        <T id="tips.trigger" />
    </div>
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
