<script lang="ts">
    import { keysToID, sortByName } from "../../../components/helpers/array"
    import T from "../../../components/helpers/T.svelte"
    import { categories, chumsSyncCategories, shows } from "../../../stores"
    import { translate } from "../../../utils/language"
    import MaterialCheckbox from "../../inputs/MaterialCheckbox.svelte"

    const mappedCategories = keysToID($categories)
        .filter((a) => !a.isArchive && a.name)
        .map((category) => {
            const name = category.default ? translate(category.name) || category.name : category.name
            const count = Object.values($shows).filter((show) => show.category === category.id).length
            return { id: category.id, name, icon: category.icon, count }
        })

    const categoryOptions = sortByName(mappedCategories)

    function toggleCategory(id: string) {
        if ($chumsSyncCategories.indexOf(id) === -1) chumsSyncCategories.update(() => [...$chumsSyncCategories, id])
        else chumsSyncCategories.update(() => $chumsSyncCategories.filter((c) => c !== id))
    }
</script>

<p class="tip"><T id="chums.sync_categories_description" /></p>

<div class="categories">
    {#each categoryOptions as { id, name, count }}
        <MaterialCheckbox label="{name} <span style='opacity: 0.7;font-size: 0.7em;'>({count})</span>" checked={$chumsSyncCategories.includes(id)} on:change={() => toggleCategory(id)} />
    {/each}
</div>

<style>
    .tip {
        margin-bottom: 10px;

        opacity: 0.7;
        font-size: 0.8em;
    }

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
