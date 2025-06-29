<script lang="ts">
    import { keysToID, sortByName } from "../../../components/helpers/array"
    import T from "../../../components/helpers/T.svelte"
    import Checkbox from "../../../components/inputs/Checkbox.svelte"
    import { categories, chumsSyncCategories, shows } from "../../../stores"
    import { translate } from "../../../utils/language"
    import Icon from "../../helpers/Icon.svelte"
    import CombinedInput from "../../inputs/CombinedInput.svelte"

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
    {#each categoryOptions as { id, name, icon, count }}
        <CombinedInput>
            <p style="flex: 1;">
                <Icon style="border-right: none;" id={icon || "noIcon"} custom right />
                {name} <span style="border: none;" class="count">({count})</span>
            </p>
            <div style="flex: 0;padding: 0 10px;" class="alignRight">
                <Checkbox checked={$chumsSyncCategories.includes(id)} on:change={() => toggleCategory(id)} />
            </div>
        </CombinedInput>
    {/each}
</div>

<!-- <CombinedInput style="margin-top: 10px;">
    <Button style="width: 100%;" on:click={() => activePopup.set(null)} center>
        <Icon id="check" size={1.2} right />
        <T id="actions.done" />
    </Button>
</CombinedInput> -->

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
    }

    .count {
        display: flex;
        align-items: center;
        margin-inline-start: 8px;

        opacity: 0.7;
        font-size: 0.7em;
    }
</style>
