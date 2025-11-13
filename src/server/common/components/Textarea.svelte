<script lang="ts">
    import { translate } from "../../remote/util/helpers"
    import { dictionary } from "../../remote/util/stores"

    export let value: string
</script>

<textarea style={$$props.style || ""} bind:value placeholder="{translate('empty.text', $dictionary)}..."></textarea>

<style>
    textarea {
        flex: 1;

        padding: 16px;
        outline: none;
        border: 1px solid var(--primary-lighter);
        border-radius: 8px;

        background-color: var(--primary-darker);
        color: inherit;
        font-size: inherit;
        font-family: inherit;

        resize: none;
        transition: border-color 0.2s ease, box-shadow 0.2s ease, background-color 0.2s ease;
        /* FreeShow UI scrollbar */
        scrollbar-width: thin; /* Firefox */
        scrollbar-color: rgb(255 255 255 / 0.3) rgb(255 255 255 / 0.05);
    }
    textarea:hover {
        border-color: color-mix(in oklab, var(--primary-lighter) 60%, var(--secondary));
        background-color: var(--hover);
    }
    textarea:focus {
        border-color: var(--secondary);
        box-shadow: 0 0 0 3px var(--secondary-opacity);
        background-color: var(--primary-darker);
    }
    textarea::-webkit-scrollbar { width: 8px; height: 8px; }
    textarea::-webkit-scrollbar-track,
    textarea::-webkit-scrollbar-corner { background: rgb(255 255 255 / 0.05); }
    textarea::-webkit-scrollbar-thumb { background: rgb(255 255 255 / 0.3); border-radius: 8px; }
    textarea::-webkit-scrollbar-thumb:hover { background: rgb(255 255 255 / 0.5); }

    textarea::placeholder {
        color: var(--text);
        opacity: 0.4;
    }
</style>
