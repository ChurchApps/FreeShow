<script lang="ts">
    import { onMount } from "svelte"
    import { actions, categories, popupData } from "../../../stores"
    import T from "../../helpers/T.svelte"
    import MaterialDropdown from "../../inputs/MaterialDropdown.svelte"

    let selectedCategory = $popupData?.id
    onMount(() => {
        popupData.set({})
    })

    let currentAction = $categories[selectedCategory]?.action || ""

    let actionOptions = Object.entries($actions)
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

    let open = false
</script>

<p class="tip"><T id="category.action_tip" /></p>

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
