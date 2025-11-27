<script lang="ts">
    import { onMount } from "svelte"
    import { activePopup, activeShow, showsCache, special } from "../../../../stores"
    import Icon from "../../../helpers/Icon.svelte"
    import { _show } from "../../../helpers/shows"
    import T from "../../../helpers/T.svelte"
    import InputRow from "../../../input/InputRow.svelte"
    import MaterialButton from "../../../inputs/MaterialButton.svelte"
    import MaterialDropdown from "../../../inputs/MaterialDropdown.svelte"
    import { isoLanguages } from "./isoLanguages"
    import { getIsoLanguages, removeTranslationFromShow, translateShow } from "./translation"

    let languageList = getIsoLanguages()

    function updateLanguage(e: any) {
        let value = e.detail
        special.update(a => {
            a.translationLanguage = value
            return a
        })
    }

    function convert() {
        if (!$special.translationLanguage) return

        translateShow(showId, $special.translationLanguage)
        translatedLangs.push($special.translationLanguage)
        translatedLangs = translatedLangs
    }

    function remove(id = "") {
        removeTranslationFromShow(showId, id)

        if (id) {
            translatedLangs.splice(translatedLangs.indexOf(id), 1)
            translatedLangs = translatedLangs
        } else {
            translatedLangs = []
            setTimeout(() => activePopup.set(null), 50)
        }
    }

    let showId = $activeShow?.id || ""

    let translatedLangs: string[] = []
    onMount(() => {
        let currentShow = $showsCache[showId] || {}
        let activeLayout = currentShow.settings?.activeLayout
        let layoutSlides = currentShow.layouts?.[activeLayout]?.slides

        layoutSlides.forEach(a => {
            _show()
                .slides([a.id])
                .get("items")
                .flat()
                .forEach(a => {
                    if (a.language) translatedLangs.push(a.language)
                })
        })

        translatedLangs = [...new Set(translatedLangs)]
        console.log(translatedLangs)
    })

    let open = false
</script>

<div class="main" style={open ? "min-height: 330px;" : ""}>
    <MaterialDropdown bind:open label="settings.language" options={languageList} value={$special.translationLanguage} on:change={updateLanguage} flags />

    <MaterialButton variant="contained" style="margin-top: 20px;width: 100%;" disabled={!$special.translationLanguage} on:click={convert}>
        <Icon size={1.1} id="translate" white />

        {#if translatedLangs.includes($special.translationLanguage)}
            <T id="localization.update" />
        {:else if translatedLangs.length}
            <T id="localization.add" />
        {:else}
            <T id="localization.translate" />
        {/if}
    </MaterialButton>

    {#if translatedLangs.length}
        <div class="list">
            {#each translatedLangs as lang}
                <InputRow>
                    <p style="flex: 1;">{isoLanguages.find(a => a.code === lang)?.name || lang}</p>
                    <MaterialButton title="settings.remove" on:click={() => remove(lang)}>
                        <Icon id="close" size={1.3} white />
                    </MaterialButton>
                </InputRow>
            {/each}
        </div>

        <MaterialButton variant="outlined" style="width: 100%;" on:click={() => remove()}>
            <Icon size={1.1} id="close" />
            <T id="localization.remove" />
        </MaterialButton>
    {/if}
</div>

<style>
    .main :global(.dropdown span) {
        line-height: 0;
        display: flex;
        align-items: center;
    }

    .list {
        display: flex;
        flex-direction: column;

        border-radius: 4px;
        overflow: hidden;

        margin-top: 20px;
    }

    .list p {
        display: flex;
        align-items: center;
        padding: 0 10px;

        flex: 1;

        background-color: var(--primary-darker);
    }
</style>
