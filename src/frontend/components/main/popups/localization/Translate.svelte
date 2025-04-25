<script lang="ts">
    import { onMount } from "svelte"
    import { activePopup, activeShow, dictionary, showsCache, special } from "../../../../stores"
    import Icon from "../../../helpers/Icon.svelte"
    import { _show } from "../../../helpers/shows"
    import T from "../../../helpers/T.svelte"
    import Button from "../../../inputs/Button.svelte"
    import CombinedInput from "../../../inputs/CombinedInput.svelte"
    import Dropdown from "../../../inputs/Dropdown.svelte"
    import { getIsoLanguages, removeTranslationFromShow, translateShow } from "./translation"
    import { isoLanguages } from "./isoLanguages"

    let languageList = getIsoLanguages()

    function updateLanguage(e: any) {
        let value = e.detail.id
        special.update((a) => {
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

        layoutSlides.forEach((a) => {
            _show()
                .slides([a.id])
                .get("items")
                .flat()
                .forEach((a) => {
                    if (a.language) translatedLangs.push(a.language)
                })
        })

        translatedLangs = [...new Set(translatedLangs)]
        console.log(translatedLangs)
    })
</script>

<div class="main">
    <CombinedInput textWidth={25}>
        <p><T id="settings.language" /></p>
        <Dropdown flags options={languageList} value={languageList.find((a) => a.id === $special.translationLanguage)?.name || "—"} on:click={updateLanguage} />
    </CombinedInput>

    <CombinedInput>
        <Button style="width: 100%;" disabled={!$special.translationLanguage} on:click={convert} center>
            <Icon size={1.1} id="translate" right />
            {#if translatedLangs.includes($special.translationLanguage)}
                <T id="localization.update" />
            {:else if translatedLangs.length}
                <T id="localization.add" />
            {:else}
                <T id="localization.translate" />
            {/if}
        </Button>
    </CombinedInput>

    {#if translatedLangs.length}
        <div class="list">
            {#each translatedLangs as lang}
                <CombinedInput textWidth={85}>
                    <p>{isoLanguages.find((a) => a.code === lang)?.name || lang}</p>
                    <Button on:click={() => remove(lang)} title={$dictionary.settings?.remove} center>
                        <Icon id="close" size={1.3} white />
                    </Button>
                </CombinedInput>
            {/each}
        </div>

        <CombinedInput>
            <Button style="width: 100%;" on:click={() => remove()} center>
                <Icon size={1.1} id="close" right />
                <T id="localization.remove" />
            </Button>
        </CombinedInput>
    {/if}
</div>

<style>
    .main {
        min-height: 330px;
    }

    .main :global(.dropdown span) {
        line-height: 0;
        display: flex;
        align-items: center;
    }

    .list {
        display: flex;
        flex-direction: column;

        padding-top: 20px;
    }
</style>
