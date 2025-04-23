<script lang="ts">
    import Textarea from "../../../common/components/Textarea.svelte"
    import { send } from "../../util/socket"
    import { activeShow } from "../../util/stores"

    export let value: string

    $: id = $activeShow?.id
    $: if (id) getText()
    function getText() {
        send("API:get_plain_text", { id })
    }
</script>

<Textarea bind:value />
