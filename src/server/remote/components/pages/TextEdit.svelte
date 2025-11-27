<script lang="ts">
    import Button from "../../../common/components/Button.svelte"
    import Icon from "../../../common/components/Icon.svelte"
    import Textarea from "../../../common/components/Textarea.svelte"
    import { hasChords, transposeText } from "../../../common/util/transpose"
    import { translate } from "../../util/helpers"
    import { send } from "../../util/socket"
    import { activeShow, dictionary } from "../../util/stores"

    export let value: string

    $: id = $activeShow?.id
    $: if (id) getText()
    function getText() {
        send("API:get_plain_text", { id })
    }

    // Transpose functionality
    $: showTransposeButtons = hasChords(value)

    function transposeUp() {
        value = transposeText(value, 1)
    }

    function transposeDown() {
        value = transposeText(value, -1)
    }
</script>

<div class="editor-container">
    <Textarea bind:value />

    {#if showTransposeButtons}
        <div class="transpose-buttons">
            <Button on:click={transposeUp} title={translate("edit.transpose_up", $dictionary)} dark>
                <Icon id="up" size={1.3} />
            </Button>
            <Button on:click={transposeDown} title={translate("edit.transpose_down", $dictionary)} dark>
                <Icon id="down" size={1.3} />
            </Button>
        </div>
    {/if}
</div>

<style>
    .editor-container {
        display: flex;
        flex-direction: column;
        height: 100%;
        flex: 1;
        position: relative;
        z-index: 1;
    }

    .editor-container :global(textarea) {
        border-radius: 8px 8px 0 0;
    }

    .transpose-buttons {
        position: absolute;
        bottom: 10px;
        right: 10px;
        display: flex;
        flex-direction: column;
        gap: 4px;
        z-index: 10;
    }

    .transpose-buttons :global(button) {
        padding: 0.4em;
        min-width: 36px;
        min-height: 36px;
        display: flex;
        align-items: center;
        justify-content: center;
    }
</style>
