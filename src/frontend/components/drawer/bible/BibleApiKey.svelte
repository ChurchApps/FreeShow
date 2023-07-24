<script lang="ts">
    import { bibleApiKey } from "../../../stores"
    import TextInput from "../../inputs/TextInput.svelte"

    function updateApiKey(e: any) {
        bibleApiKey.set(e.target.value || "")
    }
</script>

<div>
    Import your own bible, or get a free Bible API key here...
    <TextInput placeholder="Paste API key here..." value="" on:change={updateApiKey} />
</div>

<style>
    div {
        display: flex;
        flex-direction: column;
        gap: 10px;
        width: 100%;
        font-size: 1.2em;
        padding: 20px;
        background-color: var(--primary);
    }
</style>
