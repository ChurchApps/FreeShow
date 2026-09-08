<script lang="ts">
    import type { CustomFont } from "../../../../types/Show"
    import { customFonts } from "../../../stores"
    import { newToast } from "../../../utils/common"
    import { getSystemFontsList, loadCustomFont } from "../../helpers/fonts"
    import Icon from "../../helpers/Icon.svelte"
    import T from "../../helpers/T.svelte"
    import InputRow from "../../input/InputRow.svelte"
    import MaterialButton from "../../inputs/MaterialButton.svelte"
    import MaterialFilePicker from "../../inputs/MaterialFilePicker.svelte"
    import MaterialTextInput from "../../inputs/MaterialTextInput.svelte"
    import Center from "../../system/Center.svelte"

    $: fonts = $customFonts

    let systemFontsList: any[] = []
    let fontFamily = ""
    let isValidFamily = false
    async function updateFontFamily(value: string) {
        fontFamily = value.trim()

        if (!systemFontsList.length) systemFontsList = await getSystemFontsList()

        isValidFamily = isValid()

        function isValid() {
            if (!fontFamily.length) return false

            let nameLower = fontFamily.toLowerCase()

            const alreadyExists = fonts.some((a) => a.name.toLowerCase() === nameLower)
            if (alreadyExists) {
                newToast(`Font with name "${fontFamily}" already exists`)
                return false
            }

            if (systemFontsList.some((a) => a.label.toLowerCase() === nameLower)) {
                newToast(`Font with name "${fontFamily}" already exists as a system font`)
                return false
            }

            return true
        }
    }

    let addingFont = false
    async function addFont(font: CustomFont) {
        if (addingFont) return

        addingFont = true

        const isValidFont = await loadCustomFont(font)
        if (!isValidFont) {
            newToast("Could not load font")
            addingFont = false
            return
        }

        customFonts.set([...$customFonts, font])

        newFontInput = false
        addingFont = false
        fontFamily = ""
    }

    async function addGoogleFont() {
        await addFont({ type: "google", name: fontFamily })
    }

    function addLocalFont(path: string) {
        // const name = removeExtension(getFileName(path))
        addFont({ type: "local", name: fontFamily, path })
    }

    function removeFont(index: number) {
        customFonts.set($customFonts.filter((_, i) => i !== index))
    }

    let newFontInput = false
</script>

{#if fonts.length}
    {#each fonts as font, index}
        <InputRow>
            <div class="name" data-title={font.path || "Google Fonts"}>
                <Icon id={font.path ? "text" : "web"} white />
                <p style="font-family: {font.name}, sans-serif;">{font.name}</p>
                <p style="font-size: 0.7em;opacity: 0.7;max-width: 65%;">{font.path || "Google Fonts"}</p>
            </div>

            <MaterialButton icon="delete" title="actions.delete" disabled={addingFont} on:click={() => removeFont(index)} />
        </InputRow>
    {/each}
{:else if !newFontInput}
    <Center faded padding={10} style="padding-top: 0;">
        <T id="empty.general" />
    </Center>
{/if}

{#if newFontInput}
    {#if fonts.length}<div style="padding: 5px;" />{/if}

    <MaterialTextInput label="settings.font_family" value={fontFamily} disabled={addingFont} on:change={(e) => updateFontFamily(e.detail)} />

    <InputRow>
        <MaterialFilePicker label="scripture.local (.woff/.ttf/.otf)" title="actions.import" value="" icon="text" filter={{ name: "Font File", extensions: ["woff", "woff2", "ttf", "otf"] }} disabled={!isValidFamily || addingFont} style="width: initial;flex: 1;" on:change={(e) => addLocalFont(e.detail)} />

        <MaterialButton icon="web" title="Import from Google Fonts" disabled={!isValidFamily || addingFont} on:click={addGoogleFont}>Google Fonts</MaterialButton>
    </InputRow>
{/if}

<MaterialButton variant="outlined" style="width: 100%;margin-top: 10px;" icon="add" disabled={newFontInput} on:click={() => (newFontInput = true)}>
    <T id="settings.add" />
</MaterialButton>

<style>
    .name {
        display: flex;
        align-items: center;
        gap: 8px;

        flex: 1;
        max-width: 92%;
        padding: 10px 12px;
        border-radius: 4px;

        background-color: var(--primary-darker);
        border-bottom: 1px solid var(--primary-lighter);
    }
</style>
