<script lang="ts">
    import { onDestroy } from "svelte"
    import { uid } from "uid"
    import { Main } from "../../../../types/IPC/Main"
    import { ToMain } from "../../../../types/IPC/ToMain"
    import { TranslationMethod } from "../../../../types/Songbeamer"
    import { destroyMain, receiveToMain, sendMain } from "../../../IPC/main"
    import { activePopup, contentProviderData, drawerTabsData } from "../../../stores"
    import { translateText } from "../../../utils/language"
    import T from "../../helpers/T.svelte"
    import HRule from "../../input/HRule.svelte"
    import InputRow from "../../input/InputRow.svelte"
    import MaterialButton from "../../inputs/MaterialButton.svelte"
    import MaterialDropdown from "../../inputs/MaterialDropdown.svelte"
    import MaterialFolderPicker from "../../inputs/MaterialFolderPicker.svelte"

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

    let folderPath: string = $contentProviderData.churchtools?.sngFolder || ""

    const FOLDER_PICK_ID = uid()
    const listenerId = receiveToMain(ToMain.OPEN_FOLDER2, (data) => {
        if (data.channel !== FOLDER_PICK_ID || !data.path) return
        folderPath = data.path
    })
    onDestroy(() => destroyMain(listenerId))

    function importSettings() {
        return { encoding: selectedEncoding, category: showCategory, translation: selectedTranslationMethod }
    }

    function importFromFiles() {
        sendMain(Main.IMPORT, {
            channel: "songbeamer",
            format: { name: "Songbeamer", extensions: ["sng"] },
            settings: importSettings()
        })
        $activePopup = null
    }

    function importFromFolder() {
        if (!folderPath) return
        sendMain(Main.IMPORT, {
            channel: "songbeamer",
            format: { name: "Songbeamer", extensions: ["sng"] },
            settings: importSettings(),
            folder: folderPath
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

<MaterialFolderPicker label="songbeamer_import.folder" value={folderPath} on:change={(e) => (folderPath = e.detail)} allowEmpty openButton={!!folderPath} />

<InputRow>
    <MaterialButton variant="outlined" icon="import" on:click={importFromFiles}>
        <T id="actions.import" />
    </MaterialButton>
    <MaterialButton variant="outlined" icon="folder" disabled={!folderPath} on:click={importFromFolder}>
        <T id="songbeamer_import.import_folder" />
    </MaterialButton>
</InputRow>
