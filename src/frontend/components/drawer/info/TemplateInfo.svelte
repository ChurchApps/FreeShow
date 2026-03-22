<script lang="ts">
    import { special } from "../../../stores"
    import Icon from "../../helpers/Icon.svelte"
    import FloatingInputs from "../../input/FloatingInputs.svelte"
    import MaterialButton from "../../inputs/MaterialButton.svelte"
    import MaterialTextInput from "../../inputs/MaterialTextInput.svelte"
    import MaterialToggleSwitch from "../../inputs/MaterialToggleSwitch.svelte"

    let settingsOpened = false

    function updateSpecial(value: any, key: string, allowEmpty = false) {
        special.update((a) => {
            if (!allowEmpty && !value) delete a[key]
            else a[key] = value

            return a
        })
    }
</script>

<div class="scroll">
    {#if settingsOpened}
        <main style="overflow-x: hidden;padding: 10px;">
            <MaterialTextInput label="settings.capitalize_words" title="settings.comma_seperated" value={$special.capitalize_words || ""} defaultValue="Jesus, Lord" on:change={(e) => updateSpecial(e.detail, "capitalize_words", true)} />
            <!-- "text_can_overflow": "Allow text outside of the textbox bounds", -->
            <!-- <MaterialToggleSwitch label="settings.text_can_overflow" checked={$special.textCanOverflow !== false} defaultValue={true} on:change={(e) => updateSpecial(e.detail, "textCanOverflow", true)} /> -->

            <MaterialToggleSwitch label="settings.style_template_preview" checked={$special.styleTemplatePreview !== false} defaultValue={true} on:change={(e) => updateSpecial(e.detail, "styleTemplatePreview", true)} />
        </main>
    {/if}
</div>

<FloatingInputs round>
    <MaterialButton isActive={settingsOpened} title="edit.options" on:click={() => (settingsOpened = !settingsOpened)}>
        <Icon size={1.1} id="options" white={!settingsOpened} />
    </MaterialButton>
</FloatingInputs>

<style>
    .scroll {
        display: flex;
        flex-direction: column;
        flex: 1;
        overflow-y: auto;
        overflow-x: hidden;
    }
</style>
