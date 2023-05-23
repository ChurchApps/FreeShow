<script lang="ts">
    import type { TabsObj } from "../../../types/Tabs"
    import { dictionary, labelsDisabled } from "../../stores"
    import Icon from "../helpers/Icon.svelte"
    import T from "../helpers/T.svelte"
    import Button from "../inputs/Button.svelte"

    export let tabs: TabsObj
    export let active: string
    export let labels: boolean = $labelsDisabled ? false : true
</script>

<div class="tabs">
    {#each Object.entries(tabs) as tab}
        {#if tab[1].remove !== true}
            <Button on:click={() => (active = tab[0])} active={active === tab[0]} disabled={tab[1].disabled} title={$dictionary.tooltip?.[tab[0]]} dark center>
                <Icon id={tab[1].icon} />
                {#if labels}
                    {#key tab[1].name}
                        <span style="margin-left: 0.5em;">
                            <T id={tab[1].name} />
                        </span>
                    {/key}
                {/if}
            </Button>
        {/if}
    {/each}
</div>

<style>
    .tabs {
        display: flex;
        flex-wrap: wrap;
        background-color: var(--primary-darker);
    }

    .tabs :global(button) {
        flex: auto;
    }
</style>
