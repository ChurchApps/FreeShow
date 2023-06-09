<script lang="ts">
    export let style: string = ""
</script>

<div class="input" {style}>
    <slot />
</div>

<style>
    .input {
        position: relative;

        display: flex;
        align-items: center;
        width: 100%;
        min-height: 40px;
        /* margin: 2px 0; */

        background-color: var(--primary-darker);
        border-bottom: 2px solid var(--primary-lighter);
    }

    .input :global(*:not(:first-child)) {
        border-left: 1px solid var(--primary);
    }
    .input :global(*:not(:last-child)) {
        border-right: 1px solid var(--primary);
    }
    .input :global(*:not(:first-child):not(:last-child)) {
        border-left: 1px solid var(--primary);
        border-right: 1px solid var(--primary);
    }

    .input :global(input),
    .input :global(button),
    .input :global(p),
    .input :global(div),
    .input :global(span) {
        min-height: inherit;
        min-width: inherit;
    }

    /* .input :global(input:not([type="checkbox"])) {
        background-color: var(--primary-darker);
    } */

    .input :global(button),
    .input :global(.numberInput *) {
        border: none !important;
    }

    .input :global(.switch) {
        position: absolute;
        right: 10px;
    }

    .input :global(:nth-child(2):not(.switch)) {
        flex: 1;
    }

    .input :global(.numberInput span.input) {
        flex: 4;
    }

    .input :global(p) {
        display: flex;
        align-items: center;

        padding: 0 10px;
        overflow: initial;
        min-width: 30%;
        /* max-width: 40%; */
    }
</style>
