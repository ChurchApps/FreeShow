<script lang="ts">
    import { translateText } from "../../utils/language"

    export let title = ""
</script>

<div class="title">
    {#if title}
        <span style="opacity: 0.8;">{translateText(title)}</span>
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
        margin-inline-end: 10px;
    }
    .title:not(:empty)::after {
        margin-inline-start: 10px;
    }
</style>
