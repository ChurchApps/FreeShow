<script lang="ts">
    import { send } from "../../util/socket"
    import { activeShow } from "../../util/stores"

    export let value: string

    $: id = $activeShow.id
    $: if (id) getText()
    function getText() {
        send("API:get_plain_text", { id })
    }
</script>

<textarea bind:value></textarea>

<style>
    textarea {
        flex: 1;

        padding: 20px;
        outline: none;
        border: none;

        background-color: inherit;
        color: inherit;
        font-size: inherit;
        font-family: inherit;

        resize: none;
    }
</style>
