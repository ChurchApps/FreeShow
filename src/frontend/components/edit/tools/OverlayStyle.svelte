<script lang="ts">
    import type { Item } from "../../../../types/Show"
    import ItemsList from "./ItemsList.svelte"

    export let allSlideItems: Item[]
</script>

<div class="tools">
    <ItemsList bind:allSlideItems />
</div>

<style>
    .tools {
        padding: 8px 5px;

        display: flex;
        flex-direction: column;
        gap: 5px;
    }
</style>
