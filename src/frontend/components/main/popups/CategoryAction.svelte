<script lang="ts">
    import { onMount } from "svelte"
    import { actions, categories, popupData } from "../../../stores"
    import CombinedInput from "../../inputs/CombinedInput.svelte"
    import Dropdown from "../../inputs/Dropdown.svelte"
    import T from "../../helpers/T.svelte"

    let selectedCategory = $popupData?.id
    onMount(() => {
        popupData.set({})
    })

    let currentAction = $categories[selectedCategory]?.action

    let actionOptions = [
        { id: "", name: "—" },
        ...Object.entries($actions)
            .map(([id, a]) => ({ id, name: a.name }))
            .sort((a, b) => a.name?.localeCompare(b.name))
    ]

    function updateValue(e: any) {
        let id = e.detail?.id
        console.log(e, id, selectedCategory, $categories, currentAction)

        categories.update((a) => {
            if (!a[selectedCategory]) return a

            a[selectedCategory].action = id
            return a
        })

        currentAction = id
    }
</script>

<p class="tip"><T id="category.action_tip" /></p>

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
