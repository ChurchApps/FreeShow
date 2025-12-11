<script lang="ts">
    import { actions, activeShow, showsCache } from "../../../stores"
    import T from "../../helpers/T.svelte"
    import { _show } from "../../helpers/shows"
    import MaterialDropdown from "../../inputs/MaterialDropdown.svelte"

    let currentAction = _show().get("settings.customAction") || ""

    let actionOptions = Object.entries($actions)
        .map(([id, a]) => ({ id, name: a.name }))
        .sort((a, b) => a.name?.localeCompare(b.name))

    function updateValue(id: string) {
        showsCache.update((a) => {
            if (!a[$activeShow?.id || ""]) return a

            a[$activeShow!.id].settings.customAction = id
            return a
        })

        currentAction = id
    }

    let open = false
</script>

<p class="tip"><T id="show.custom_action_tip" /></p>

<div style="min-height: {open ? 350 : 0}px;">
    <MaterialDropdown bind:open label="midi.start_action" options={actionOptions.map((a) => ({ label: a.name, value: a.id }))} value={currentAction} allowEmpty on:change={(e) => updateValue(e.detail)} />
</div>

<style>
    .tip {
        margin-bottom: 10px;
        opacity: 0.7;
        font-size: 0.9em;
    }
</style>
