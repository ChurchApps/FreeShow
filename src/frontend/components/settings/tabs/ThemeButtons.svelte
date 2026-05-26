<script lang="ts">
    import { theme, themes } from "../../../stores"
    import { updateThemeValues } from "../../../utils/updateSettings"
    import { clone } from "../../helpers/array"
    import MaterialButton from "../../inputs/MaterialButton.svelte"
    import { defaultThemes } from "./defaultThemes"

    function resetThemes() {
        theme.set("default")
        themes.set(clone(defaultThemes))
        updateThemeValues(defaultThemes.default)
    }

    // function importTheme() {
    //     const format = { extensions: ["fstheme", "theme", "json"], name: translateText("formats.theme") }
    //     sendMain(Main.IMPORT, { channel: "freeshow_theme", format })
    // }
</script>

{#if Object.values($themes).length < 11}
    <MaterialButton title="settings.reset_themes" icon="reset" on:click={resetThemes} />
{/if}
<!-- <MaterialButton title="actions.import" icon="import" on:click={importTheme} /> -->
