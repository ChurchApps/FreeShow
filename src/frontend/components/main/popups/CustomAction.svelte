<script lang="ts">
    import { actions, activeShow, showsCache } from "../../../stores"
    import { _show } from "../../helpers/shows"
    import MaterialDropdown from "../../inputs/MaterialDropdown.svelte"
    import Tip from "../Tip.svelte"

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
</script>

<Tip type="info" value="show.custom_action_tip" bottom={20} />

<MaterialDropdown label="midi.start_action" options={actionOptions.map((a) => ({ label: a.name, value: a.id }))} value={currentAction} allowEmpty on:change={(e) => updateValue(e.detail)} />
