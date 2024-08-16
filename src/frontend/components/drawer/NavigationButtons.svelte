<script lang="ts">
    import { SelectIds } from "../../../types/Main"
    import T from "../helpers/T.svelte"
    import Center from "../system/Center.svelte"
    import SelectElem from "../system/SelectElem.svelte"
    import NavigationButton from "./NavigationButton.svelte"

    export let buttons
    export let id: string
    export let selectId: SelectIds
</script>

{#key buttons}
    {#if buttons.length}
        {#each buttons as category}
            {#if category.id === "SEPERATOR"}
                <hr />
            {:else}
                <SelectElem id={selectId} borders="center" trigger="column" data={category.id}>
                    <NavigationButton {id} {category} {length} />
                </SelectElem>
            {/if}
        {/each}
    {:else}
        <Center faded>
            <T id="empty.general" />
        </Center>
    {/if}
{/key}

<!-- {#if id === "scripture"}
<a class="source" href="#void" on:click={() => window.api.send(MAIN, { channel: "URL", data: "https://scripture.api.bible/" })}> API.Bible </a>
{/if} -->

<style>
    hr {
        height: 2px;
        border: none;
        background-color: var(--primary-lighter);
    }
</style>
