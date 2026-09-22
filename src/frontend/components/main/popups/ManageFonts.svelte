<script lang="ts">
    import { onMount } from "svelte"
    import type { CustomFont } from "../../../../types/Show"
    import { customFonts, special } from "../../../stores"
    import { newToast } from "../../../utils/common"
    import { defaultFonts, getSystemFontsList, loadCustomFont } from "../../helpers/fonts"
    import Icon from "../../helpers/Icon.svelte"
    import T from "../../helpers/T.svelte"
    import HRule from "../../input/HRule.svelte"
    import InputRow from "../../input/InputRow.svelte"
    import MaterialButton from "../../inputs/MaterialButton.svelte"
    import MaterialFilePicker from "../../inputs/MaterialFilePicker.svelte"
    import MaterialTextInput from "../../inputs/MaterialTextInput.svelte"
    import Center from "../../system/Center.svelte"

    $: fonts = $customFonts

    let systemFonts: { label: string; value: string; style: string }[] = []
    onMount(async () => {
        const fonts = await getSystemFontsList(false)
        // remove built-in fonts from system fonts list
        systemFonts = fonts.filter((a) => !defaultFonts.includes(a.label))
    })

    let fontFamily = ""
    let isValidFamily = false
    async function updateFontFamily(value: string) {
        fontFamily = value.trim()
        isValidFamily = isValid()

        function isValid() {
            if (!fontFamily.length) return false

            let nameLower = fontFamily.toLowerCase()

            const alreadyExists = fonts.some((a) => a.name.toLowerCase() === nameLower)
            if (alreadyExists) {
                newToast(`Font with name "${fontFamily}" already exists`)
                return false
            }

            const fontsList = [...systemFonts.map((a) => a.label), ...defaultFonts]
            if (fontsList.some((font) => font.toLowerCase() === nameLower)) {
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

    let hiddenSystemFonts: string[] = $special.hiddenFonts || []
    function toggleHiddenSystemFont(label: string) {
        if (hiddenSystemFonts.includes(label)) hiddenSystemFonts = hiddenSystemFonts.filter((a) => a !== label)
        else hiddenSystemFonts = [...hiddenSystemFonts, label]

        special.update((s) => ({ ...s, hiddenFonts: hiddenSystemFonts }))
    }

    let newFontInput = false
</script>

<!-- Built-in -->
<InputRow arrow>
    <div class="name" data-title="Built-in the program">
        <Icon id="text" white />
        <p><T id="example.default" /></p>
        <p style="font-size: 0.7em;opacity: 0.7;max-width: 65%;">{defaultFonts.length}</p>
    </div>

    <svelte:fragment slot="menu">
        {#each defaultFonts as font}
            <InputRow>
                <div class="name" style="max-width: unset;">
                    <p style="font-family: {font}, sans-serif;">{font}</p>
                </div>
            </InputRow>
        {/each}
    </svelte:fragment>
</InputRow>

<!-- System fonts -->
<InputRow style="margin-top: 10px;" arrow>
    <div class="name" data-title="Installed on your system">
        <Icon id="folder" white />
        <p>System</p>
        <p style="font-size: 0.7em;opacity: 0.7;max-width: 65%;">
            {systemFonts.length}
            {#if hiddenSystemFonts.length}({systemFonts.length - hiddenSystemFonts.length}){/if}
        </p>
    </div>

    <svelte:fragment slot="menu">
        {#each systemFonts as font}
            {@const isHidden = hiddenSystemFonts.includes(font.label)}

            <InputRow>
                <div class="name">
                    <p style={font.style}>{font.label}</p>
                </div>

                <MaterialButton title={isHidden ? "profile.show" : "profile.hide"} style="padding: 0.75rem;min-width: 50px;" on:click={() => toggleHiddenSystemFont(font.label)}>
                    <Icon id={isHidden ? "hide" : "eye"} white={isHidden} />
                </MaterialButton>
            </InputRow>
        {/each}
    </svelte:fragment>
</InputRow>

<HRule title="sort.custom" />

{#if fonts.length}
    {#each fonts as font, index}
        <InputRow>
            <div class="name" data-title={font.path || "Google Fonts"}>
                <Icon id={font.path ? "text" : "web"} white />
                <p style="font-family: {font.name}, sans-serif;">{font.name}</p>
                <p style="font-size: 0.7em;opacity: 0.7;max-width: 65%;">{font.path || "Google Fonts"}</p>
            </div>

            <MaterialButton icon="delete" title="actions.delete" disabled={addingFont} style="padding: 0.75rem;min-width: 50px;" on:click={() => removeFont(index)} />
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
