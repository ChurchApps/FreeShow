<script lang="ts">
    import { Main } from "../../../../types/IPC/Main"
    import { sendMain } from "../../../IPC/main"
    import { dataPath, theme, themes } from "../../../stores"
    import { translateText } from "../../../utils/language"
    import { updateThemeValues } from "../../../utils/updateSettings"
    import { clone } from "../../helpers/array"
    import MaterialButton from "../../inputs/MaterialButton.svelte"
    import { defaultThemes } from "./defaultThemes"

    function resetThemes() {
        theme.set("default")
        themes.set(clone(defaultThemes))
        updateThemeValues(defaultThemes.default)
    }

    function importTheme() {
        const format = { extensions: ["fstheme", "theme", "json"], name: translateText("formats.theme") }
        sendMain(Main.IMPORT, { channel: "freeshow_theme", format, settings: { path: $dataPath } })
    }
</script>

{#if Object.values($themes).length < 10}
    <MaterialButton title="settings.reset_themes" icon="reset" on:click={resetThemes} />
{/if}
<MaterialButton title="actions.import" icon="import" on:click={importTheme} />
