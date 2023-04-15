<script lang="ts">
    import type { TopViews } from "../../../types/Tabs"
    import { activePage, dictionary, labelsDisabled } from "../../stores"
    import Icon from "../helpers/Icon.svelte"
    import T from "../helpers/T.svelte"
    import Button from "./Button.svelte"

    export let id: TopViews
    export let hideLabel: null | boolean = null
    $: label = hideLabel === null ? !$labelsDisabled : !hideLabel

    $: title = $dictionary.menu?.["_title_" + id]
</script>

<div>
    <Button {title} active={$activePage === id} on:click={() => activePage.set(id)}>
        <Icon {id} size={1.8} right={label} />
        {#if label}
            <span><T id={"menu." + id} /></span>
        {/if}
    </Button>
</div>

<style>
    div :global(button) {
        /* padding: 10px; */
        display: flex;
        /* flex-direction: column; */
        justify-content: center;
        min-width: 60px;
        height: 100%;
    }
</style>
