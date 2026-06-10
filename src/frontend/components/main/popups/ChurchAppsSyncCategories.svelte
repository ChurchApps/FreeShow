<script lang="ts">
    import { categories, contentProviderData, shows } from "../../../stores"
    import { translateText } from "../../../utils/language"
    import { keysToID, sortByName } from "../../helpers/array"
    import MaterialCheckbox from "../../inputs/MaterialCheckbox.svelte"
    import Tip from "../Tip.svelte"

    const mappedCategories = keysToID($categories)
        .filter((a) => !a.isArchive && a.name)
        .map((category) => {
            const name = category.default ? translateText(category.name) || category.name : category.name
            const count = Object.values($shows).filter((show) => show.category === category.id).length
            return { id: category.id, name, icon: category.icon, count }
        })

    const categoryOptions = sortByName(mappedCategories)

    $: currentlySelected = $contentProviderData.churchApps?.syncCategories || []

    function toggleCategory(id: string) {
        contentProviderData.update((a) => {
            if (currentlySelected.indexOf(id) === -1) {
                a.churchApps = { ...a.churchApps, syncCategories: [...currentlySelected, id] }
            } else {
                a.churchApps = { ...a.churchApps, syncCategories: currentlySelected.filter((c) => c !== id) }
            }

            return a
        })
    }
</script>

<Tip type="info" value="settings.sync_categories_tip" bottom={20} />

<div class="categories">
    {#each categoryOptions as { id, name, count }}
        <MaterialCheckbox label="{name} <span style='opacity: 0.7;font-size: 0.7em;'>({count})</span>" checked={currentlySelected.includes(id)} on:change={() => toggleCategory(id)} />
    {/each}
</div>

<style>
    .categories {
        display: flex;
        flex-direction: column;
        max-height: 300px;
        overflow-y: auto;

        border-radius: 4px;
    }
    .categories :global(.checkboxfield:nth-child(odd) .hover) {
        background-color: rgb(0 0 20 / 0.15);
    }
</style>
