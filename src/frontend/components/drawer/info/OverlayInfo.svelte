<script lang="ts">
    import { drawerTabsData } from "../../../stores"
    import { setExampleOverlays } from "../../../utils/createData"
    import { getAccess } from "../../../utils/profile"
    import Icon from "../../helpers/Icon.svelte"
    import T from "../../helpers/T.svelte"
    import Button from "../../inputs/Button.svelte"
    import EffectsInfo from "./EffectsInfo.svelte"

    $: subTab = $drawerTabsData.overlays?.activeSubTab || ""

    const profile = getAccess("overlays")
    $: readOnly = profile.global === "read" || profile[subTab] === "read"
</script>

{#if subTab === "effects"}
    <EffectsInfo />
{:else if !readOnly}
    <div class="scroll" />

    <Button style="width: 100%;" title="This will reset the defaults (shield icon). And pull in any new ones." on:click={setExampleOverlays} center dark>
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
