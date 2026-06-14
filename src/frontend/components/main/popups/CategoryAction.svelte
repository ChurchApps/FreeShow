<script lang="ts">
    import { onMount } from "svelte"
    import { actions, categories, popupData } from "../../../stores"
    import MaterialDropdown from "../../inputs/MaterialDropdown.svelte"
    import Tip from "../Tip.svelte"

    const selectedCategory = $popupData?.id
    onMount(() => {
        popupData.set({})
    })

    let currentAction = $categories[selectedCategory]?.action || ""

    const actionOptions = Object.entries($actions)
        .map(([id, a]) => ({ id, name: a.name }))
        .sort((a, b) => a.name?.localeCompare(b.name))

    function updateValue(id: string) {
        categories.update((a) => {
            if (!a[selectedCategory]) return a

            a[selectedCategory].action = id
            return a
        })

        currentAction = id
    }
</script>

<Tip type="info" value="category.action_tip" bottom={20} />

<MaterialDropdown label="midi.start_action" options={actionOptions.map((a) => ({ label: a.name, value: a.id }))} value={currentAction} allowEmpty on:change={(e) => updateValue(e.detail)} />
