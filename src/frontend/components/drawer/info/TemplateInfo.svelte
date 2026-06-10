<script lang="ts">
    import { special } from "../../../stores"
    import MaterialTextInput from "../../inputs/MaterialTextInput.svelte"
    import MaterialToggleSwitch from "../../inputs/MaterialToggleSwitch.svelte"
    import Center from "../../system/Center.svelte"
    import Clock from "../../system/Clock.svelte"
    import Date from "../../system/Date.svelte"

    export let optionsOpen: boolean

    function updateSpecial(value: any, key: string, allowEmpty = false) {
        special.update((a) => {
            if (!allowEmpty && !value) delete a[key]
            else a[key] = value

            return a
        })
    }
</script>

<div class="scroll">
    {#if optionsOpen}
        <main style="overflow-x: hidden;padding: 10px;">
            <MaterialTextInput label="settings.capitalize_words" title="settings.comma_seperated" value={$special.capitalize_words || ""} defaultValue="Jesus, Lord" on:change={(e) => updateSpecial(e.detail, "capitalize_words", true)} />
            <!-- "text_can_overflow": "Allow text outside of the textbox bounds", -->
            <!-- <MaterialToggleSwitch label="settings.text_can_overflow" checked={$special.textCanOverflow !== false} defaultValue={true} on:change={(e) => updateSpecial(e.detail, "textCanOverflow", true)} /> -->

            <MaterialToggleSwitch label="settings.style_template_preview" checked={$special.styleTemplatePreview !== false} defaultValue={true} on:change={(e) => updateSpecial(e.detail, "styleTemplatePreview", true)} />
        </main>
    {:else}
        <Center>
            <Clock />
            <Date />
        </Center>
    {/if}
</div>

<style>
    .scroll {
        display: flex;
        flex-direction: column;
        flex: 1;
        overflow-y: auto;
        overflow-x: hidden;
    }
</style>
