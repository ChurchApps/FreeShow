<!-- used to display option inputs -->

<script lang="ts">
    export let bottom: number = 0
    export let top: number = 0
</script>

<div class="list" style="margin-bottom: {bottom}px;margin-top: {top}px;{$$props.style || ''}">
    <slot />
</div>

<style>
    .list {
        display: flex;
        flex-direction: column;
        /* gap: 5px; */
    }
</style>
