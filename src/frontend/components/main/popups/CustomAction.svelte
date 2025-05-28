<script lang="ts">
    import { actions, activeShow, showsCache } from "../../../stores"
    import T from "../../helpers/T.svelte"
    import { _show } from "../../helpers/shows"
    import CombinedInput from "../../inputs/CombinedInput.svelte"
    import Dropdown from "../../inputs/Dropdown.svelte"

    let currentAction = _show().get("settings.customAction") || ""

    let actionOptions = [
        { id: "", name: "—" },
        ...Object.entries($actions)
            .map(([id, a]) => ({ id, name: a.name }))
            .sort((a, b) => a.name?.localeCompare(b.name))
    ]

    function updateValue(e: any) {
        let id = e.detail?.id

        showsCache.update((a) => {
            if (!a[$activeShow?.id || ""]) return a

            a[$activeShow!.id].settings.customAction = id
            return a
        })

        currentAction = id
    }
</script>

<p class="tip"><T id="show.custom_action_tip" /></p>

<div style="min-height: 200px;">
    <CombinedInput textWidth={30}>
        <p><T id="midi.start_action" /></p>
        <Dropdown options={actionOptions} value={actionOptions.find((a) => a.id === currentAction || "")?.name || "—"} on:click={updateValue} />
    </CombinedInput>
</div>

<style>
    .tip {
        margin-bottom: 10px;
        opacity: 0.7;
    }
</style>
