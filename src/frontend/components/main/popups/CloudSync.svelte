<script lang="ts">
    import { activePopup, popupData } from "../../../stores"
    import { chooseTeam } from "../../../utils/cloudSync"
    import MaterialMultiChoice from "../../inputs/MaterialMultiChoice.svelte"

    const type = $popupData.type

    function teamChosen(e: any) {
        const selectedId = e.detail
        const teams = $popupData.teams
        const team = teams.find((a) => a.id === selectedId)

        activePopup.set(null)
        chooseTeam(team)
    }
</script>

{#if type === "choose_team"}
    <p class="tip">Select a team where you want to sync the data.</p>
    <MaterialMultiChoice options={$popupData.teams} on:click={teamChosen} highlightFirst={false} />

    <!-- <CombinedInput style="margin-top: 10px;width: initial;">
        <MaterialButton style="width: 100%;" icon="arrow_forward" on:click={() => activePopup.set(null)}>
            <T id="guide.skip" />
        </MaterialButton>
    </CombinedInput> -->
{/if}

<style>
    .tip {
        margin-bottom: 10px;

        opacity: 0.7;
        font-size: 0.8em;
    }
</style>
