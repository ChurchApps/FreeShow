<script lang="ts">
    import { Main } from "../../../../types/IPC/Main"
    import { TranslationMethod } from "../../../../types/Songbeamer"
    import { sendMain } from "../../../IPC/main"
    import { activePopup, drawerTabsData } from "../../../stores"
    import { translateText } from "../../../utils/language"
    import T from "../../helpers/T.svelte"
    import HRule from "../../input/HRule.svelte"
    import InputRow from "../../input/InputRow.svelte"
    import MaterialButton from "../../inputs/MaterialButton.svelte"
    import MaterialDropdown from "../../inputs/MaterialDropdown.svelte"

    const encodingOptions = [
        {
            value: "utf8",
            label: "UTF-8"
        },
        {
            value: "latin1",
            label: "Latin 1",
            data: translateText("songbeamer_import.older_versions")
        }
    ]
    let selectedEncoding = encodingOptions[0].value

    const activeCategory = $drawerTabsData.shows?.activeSubTab
    const showCategory = activeCategory && activeCategory !== "all" && activeCategory !== "unlabeled" ? activeCategory : "songbeamer"

    let selectedTranslationMethod = TranslationMethod.MultiLine

    function importListener() {
        sendMain(Main.IMPORT, {
            channel: "songbeamer",
            format: { name: "Songbeamer", extensions: ["sng"] },
            settings: { encoding: selectedEncoding, category: showCategory, translation: selectedTranslationMethod }
        })
        $activePopup = null
    }
</script>

<MaterialDropdown label="songbeamer_import.encoding" options={encodingOptions} value={selectedEncoding} on:change={(e) => (selectedEncoding = e.detail)} />

<HRule title="songbeamer_import.translations" />

<InputRow>
    {#each Object.values(TranslationMethod) as method}
        <MaterialButton style="flex: 1;border-radius: 0;padding: 6px;border-width: 2px !important;" isActive={method === selectedTranslationMethod} on:click={() => (selectedTranslationMethod = method)}>
            <T id="songbeamer_import.translation_{method}" />
        </MaterialButton>
    {/each}
</InputRow>

<p style="margin: 10px 0;white-space: normal;opacity: 0.8;">
    <T id="songbeamer_import.translation_description_{selectedTranslationMethod}" />
</p>

<HRule />

<MaterialButton variant="outlined" icon="import" on:click={importListener}>
    <T id="actions.import" />
</MaterialButton>
