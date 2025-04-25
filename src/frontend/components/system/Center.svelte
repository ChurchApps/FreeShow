<script lang="ts">
    export let faded = false
    export let absolute = false
    export let padding = 0
    export let size = 1
    export let style = ""
</script>

<div style="font-size: {size}em;padding: {padding}px;{style}" class="loader" class:faded class:absolute>
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
        text-align: center;
    }

    .faded {
        opacity: 0.5;
        overflow: hidden;
    }

    .absolute {
        position: absolute;
        top: 50%;
        inset-inline-start: 50%;
        transform: translate(-50%, -50%);
    }
</style>
