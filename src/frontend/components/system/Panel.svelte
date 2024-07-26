<script lang="ts">
    export let flex: boolean = false
    export let column: boolean = false
</script>

<section class:flex class:column>
    <slot />
</section>

<style>
    section.flex {
        height: 100%;
        width: 100%;
        display: flex;
    }
    section.column {
        flex-direction: column;
    }

    section :global(h6) {
        color: var(--text);
        text-transform: uppercase;
        text-align: center;
        font-size: 0.9em;
        margin: 20px 0;
    }

    section :global(.line) {
        display: flex;
        align-items: center;
        background-color: var(--primary-darker);
        flex-flow: wrap;
    }

    section :global(.gap) {
        display: flex;
        gap: 10px;
    }

    section :global(.titles) {
        display: flex;
        flex-direction: column;
        justify-content: space-around;
    }

    section :global(p) {
        width: 100%;
        opacity: 0.8;
        align-self: center;
        font-size: 0.9em;
    }

    section :global(hr) {
        width: 100%;
        height: 2px;
        background-color: var(--primary-lighter);
        border: none;
        margin: 20px 0;
    }
</style>
