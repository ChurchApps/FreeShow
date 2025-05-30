<script lang="ts">
    import { activePopup, categories, chumsSyncCategories, shows } from "../../../stores"
    import { sortByName } from "../../../components/helpers/array"
    import T from "../../../components/helpers/T.svelte"
    import Button from "../../../components/inputs/Button.svelte"
    import Checkbox from "../../../components/inputs/Checkbox.svelte"
    import { translate } from "../../../utils/language"
    
    const mappedCategories = Object.entries($categories).map(([id, category]) => {
        const mapped = {
            id,
            name: category.name,
            displayName: category.default ? translate(category.name) || category.name : category.name,
            count: Object.values($shows).filter((show) => show.category === id).length,
        }
        return mapped
    })
    
    let categoryOptions: any[] = []
    $: categoryOptions = sortByName(mappedCategories, "displayName")
    

    function handleChange(id: string) {
        toggleCategory(id)
    }

    function toggleCategory(id: string) {
        if ($chumsSyncCategories.indexOf(id) === -1) chumsSyncCategories.update(() => [...$chumsSyncCategories, id])
        else chumsSyncCategories.update(() => $chumsSyncCategories.filter((c) => c !== id))
    }

</script>

<div class="popup">
    <div class="header">
        <h2><T id="chums.sync_categories" /></h2>
    </div>

    <div class="content">
        <p><T id="chums.sync_categories_description" /></p>

        <div class="categories">
            {#each categoryOptions as { id, displayName, count }}
                <div class="category">
                    <Checkbox
                        checked={$chumsSyncCategories.includes(id)}
                        on:change={() => handleChange(id)}
                    />
                    <span class="count">{displayName} ({count})</span>
                </div>
            {/each}
        </div>

        <div class="buttons">
            <Button on:click={() => (activePopup.set(null))}>
                <T id="actions.done" />
            </Button>
        </div>
    </div>
</div>

<style>
    .popup {
        width: 400px;
        max-width: 90vw;
    }

    .header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 1rem;
    }

    .content {
        display: flex;
        flex-direction: column;
        gap: 1rem;
    }

    .categories {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        max-height: 300px;
        overflow-y: auto;
    }

    .category {
        display: flex;
        align-items: center;
        gap: 0.5rem;
    }

    .count {
        color: var(--color-text-secondary);
        font-size: 0.9em;
    }

    .buttons {
        display: flex;
        justify-content: flex-end;
        margin-top: 1rem;
    }
</style> 