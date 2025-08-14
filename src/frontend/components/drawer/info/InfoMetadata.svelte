<script lang="ts">
    import { translateText } from "../../../utils/language"
    import Date from "../../system/Date.svelte"

    export let title: string | undefined
    export let info: { label: string; value: string | number | undefined | null; type?: string }[]
</script>

<div class="metadata">
    <h2 data-title={title}>
        {#if title?.length}
            {title}
        {:else}
            <span style="opacity: 0.5">{translateText("main.unnamed")}</span>
        {/if}
    </h2>

    <div class="table">
        {#each info as data}
            <p>
                <span class="label">
                    {translateText(data.label)}
                </span>

                <span class:default={typeof data.value === "string" ? data.value.includes(".") : false}>
                    {#if data.value}
                        {#if data.type === "date"}
                            <Date d={data.value} />
                        {:else if typeof data.value === "string"}
                            {translateText(data.value)}
                        {:else}
                            {data.value}
                        {/if}
                    {:else}
                        —
                    {/if}
                </span>
            </p>
        {/each}
    </div>
</div>

<style>
    .metadata {
        overflow-y: auto;

        background-color: var(--primary-darker);
        border: 1px solid var(--primary-lighter);
        margin: 10px 5px;
        padding: 10px 0;

        border-radius: 4px;

        font-size: 0.9em;
    }

    h2 {
        text-align: center;
        padding: 0 12px;
        margin-bottom: 10px;
    }

    .table p {
        display: flex;
        justify-content: space-between;
        gap: 10px;
        padding: 2px 12px;
    }
    .table p:nth-child(odd) {
        background-color: rgb(0 0 20 / 0.15);
    }

    .label {
        font-weight: 600;
    }
    .table p span {
        opacity: 0.8;
    }
    .table p span:not(.label) {
        opacity: 0.6;

        overflow: hidden;
        /* direction: rtl; */
    }
    .table p span.default {
        font-style: italic;
        opacity: 0.6;
    }
</style>
