<script lang="ts">
    import { activeShow, showsCache } from "../../../stores"
    import { setExampleTemplates } from "../../../utils/createData"
    import Icon from "../../helpers/Icon.svelte"
    import { removeTemplatesFromShow } from "../../helpers/show"
    import T from "../../helpers/T.svelte"
    import Button from "../../inputs/Button.svelte"

    $: currentShow = $showsCache[$activeShow?.id || ""]
    $: showTemplate = currentShow?.settings?.template

    function removeTemplate() {
        removeTemplatesFromShow($activeShow?.id || "", true)
    }
</script>

<div class="scroll" />

{#if showTemplate}
    <Button style="width: 100%;" on:click={removeTemplate} center dark>
        <Icon id="clear" right />
        <T id="actions.remove_template_from_show" />
    </Button>
{/if}

<Button style="width: 100%;" on:click={setExampleTemplates} center dark>
    <Icon id="reset" right />
    <T id="actions.reset_defaults" />
</Button>

<style>
    .scroll {
        display: flex;
        flex-direction: column;
        flex: 1;
        overflow-y: auto;
        overflow-x: hidden;
    }
</style>
