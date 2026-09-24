<script lang="ts">
    import { actions, activePopup, activeShow, popupData, scenes, showsCache } from "../../../stores"
    import { _show } from "../../helpers/shows"
    import InputRow from "../../input/InputRow.svelte"
    import MaterialButton from "../../inputs/MaterialButton.svelte"
    import MaterialDropdown from "../../inputs/MaterialDropdown.svelte"
    import Tip from "../Tip.svelte"

    let type: "scene" | "show" = $popupData?.mode || "show"
    let sceneId = $popupData?.sceneId || ""

    let currentAction = type === "scene" ? $scenes[sceneId]?.action || "" : _show().get("settings.customAction") || ""

    let actionOptions = Object.entries($actions)
        .map(([id, a]) => ({ id, name: a.name }))
        .sort((a, b) => a.name?.localeCompare(b.name))

    function updateValue(id: string) {
        if (type === "scene") {
            scenes.update((a) => {
                if (!a[sceneId]) return a

                a[sceneId].action = id
                a[sceneId].modified = Date.now()
                return a
            })
        } else {
            showsCache.update((a) => {
                if (!a[$activeShow?.id || ""]) return a

                a[$activeShow!.id].settings.customAction = id
                return a
            })
        }

        currentAction = id
    }

    function editAction() {
        popupData.set({ id: currentAction })
        activePopup.set("action")
    }
</script>

<Tip type="info" value={type === "show" ? "show.custom_action_tip" : "tips.custom_action"} bottom={20} />

<InputRow>
    <MaterialDropdown label="midi.start_action" options={actionOptions.map((a) => ({ label: a.name, value: a.id }))} value={currentAction} allowEmpty on:change={(e) => updateValue(e.detail)} />
    {#if currentAction && $actions[currentAction]}
        <MaterialButton title="titlebar.edit" icon="edit" on:click={editAction} />
    {/if}
</InputRow>
