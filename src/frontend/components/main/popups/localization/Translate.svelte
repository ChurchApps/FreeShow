<script lang="ts">
    import { onMount } from "svelte"
    import { activeShow, showsCache, special } from "../../../../stores"
    import Icon from "../../../helpers/Icon.svelte"
    import { _show } from "../../../helpers/shows"
    import T from "../../../helpers/T.svelte"
    import Button from "../../../inputs/Button.svelte"
    import CombinedInput from "../../../inputs/CombinedInput.svelte"
    import Dropdown from "../../../inputs/Dropdown.svelte"
    import { getIsoLanguages, removeAllTranslationsFromShow, translateShow } from "./translation"

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

    function remove() {
        removeAllTranslationsFromShow(showId)
        translatedLangs = []
    }

    let showId = $activeShow?.id || ""

    let translatedLangs: string[] = []
    onMount(() => {
        let currentShow = $showsCache[showId] || {}
        let activeLayout = currentShow.settings?.activeLayout
        let layoutSlides = currentShow.layouts?.[activeLayout]?.slides

        layoutSlides.find((a) => {
            _show()
                .slides([a.id])
                .get("items")
                .flat()
                .forEach((a) => {
                    if (a.language) translatedLangs.push(a.language)
                })

            return translatedLangs.length
        })

        translatedLangs = translatedLangs
    })
</script>

<div>
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
        <CombinedInput>
            <Button style="width: 100%;" on:click={remove} center>
                <Icon size={1.1} id="close" right />
                <T id="localization.remove" />
            </Button>
        </CombinedInput>
    {/if}
</div>

<style>
    div {
        min-height: 330px;
    }

    div :global(.dropdown span) {
        line-height: 0;
        display: flex;
        align-items: center;
    }
</style>
