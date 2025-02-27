<script lang="ts">
    import T from "../helpers/T.svelte"

    export let title: string = ""
</script>

<div class="title">
    {#if title}
        <span style="opacity: 0.8;"><T id={title} /></span>
    {/if}
</div>

<style>
    .title {
        display: flex;
        align-items: center;
        text-align: center;

        margin: 18px 0;
        font-size: 0.75em;
        text-transform: uppercase;

        font-weight: bold;
    }

    .title::before,
    .title::after {
        content: "";
        flex: 1;
        border-bottom: 2px solid var(--primary-lighter);
    }

    .title:not(:empty)::before {
        margin-right: 10px;
    }
    .title:not(:empty)::after {
        margin-left: 10px;
    }
</style>
