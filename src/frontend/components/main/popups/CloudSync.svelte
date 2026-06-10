<script lang="ts">
    import { activePopup, popupData } from "../../../stores"
    import { chooseTeam } from "../../../utils/cloudSync"
    import MaterialMultiChoice from "../../inputs/MaterialMultiChoice.svelte"
    import Tip from "../Tip.svelte"

    const type = $popupData.type
    const teams = $popupData.teams || []

    function teamChosen(e: any) {
        if (!Array.isArray(teams)) return

        const selectedId = e.detail
        const team = teams.find((a) => a.id === selectedId)

        activePopup.set(null)
        chooseTeam({ ...team, count: teams.length })
    }
</script>

{#if type === "choose_team"}
    <Tip type="info" value="Select a team where you want to sync the data." bottom={20} />

    <MaterialMultiChoice options={teams} on:click={teamChosen} highlightFirst={false} />

    <!-- <CombinedInput style="margin-top: 10px;width: initial;">
        <MaterialButton style="width: 100%;" icon="arrow_forward" on:click={() => activePopup.set(null)}>
            <T id="guide.skip" />
        </MaterialButton>
    </CombinedInput> -->
{/if}
