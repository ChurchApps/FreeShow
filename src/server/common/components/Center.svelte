<script lang="ts">
    export let faded: boolean = false
    export let size: number = 1
</script>

<div style="font-size: {size}em;" class:faded>
    <slot />
</div>

<style>
    div {
        display: flex;
        height: 100%;
        width: 100%;
        overflow-y: auto;
        flex-direction: column;
        justify-content: center;
        align-items: center;
    }

    .faded {
        opacity: 0.5;
    }
</style>
