<script lang="ts">
    import { uid } from "uid"
    import { Main } from "../../../../types/IPC/Main"
    import type { BibleCategories } from "../../../../types/Tabs"
    import { sendMain } from "../../../IPC/main"
    import { labelsDisabled, language, scriptures } from "../../../stores"
    import { translateText } from "../../../utils/language"
    import { replace } from "../../../utils/languageData"
    import { customBibleData } from "../../drawer/bible/scripture"
    import { sortByName } from "../../helpers/array"
    import Icon from "../../helpers/Icon.svelte"
    import T from "../../helpers/T.svelte"
    import Link from "../../inputs/Link.svelte"
    import MaterialButton from "../../inputs/MaterialButton.svelte"
    import MaterialMultiChoice from "../../inputs/MaterialMultiChoice.svelte"
    import MaterialTextInput from "../../inputs/MaterialTextInput.svelte"
    import Center from "../../system/Center.svelte"
    import Loader from "../Loader.svelte"

    let error: null | string = null
    let bibles: any[] = []

    let cachedBibles = ""
    $: if (importType === "api") fetchBibles()
    function fetchBibles() {
        // read cache
        if (cachedBibles) {
            bibles = JSON.parse(cachedBibles)
            return
        }

        const api = "https://contentapi.churchapps.org/bibles"
        fetch(api)
            .then((response) => response.json())
            .then(manageResult)
            .catch((e) => {
                console.log(e)
                error = e
            })

        function manageResult(data) {
            // console.log("MANAGE RESULT", data)
            if (!data) return

            bibles = data.map(customBibleData)

            // cache bibles
            let cache = { date: new Date(), bibles }
            cachedBibles = JSON.stringify(cache)
        }
    }

    // get list of bibles in language
    let sortedBibles: any[] = []
    let recommended: any[] = []
    $: {
        if (bibles?.length) {
            let langCode = window.navigator.language.slice(-2).toLowerCase()
            // if it needs attribution, it's probably more in demand!
            sortedBibles = sortByName(bibles).sort((a, b) => (b.attributionRequired || b.attributionString) - (a.attributionRequired || a.attributionString))
            let newSorted: any[] = []
            sortedBibles.forEach((bible) => {
                newSorted.push(bible)
                let found = false
                if (bible.countryList?.includes(langCode)) found = true

                replace[$language].forEach((r: any) => {
                    r = r.slice(-2)
                    if (bible.countryList?.includes(r.toLowerCase())) found = true
                })

                if (found) {
                    recommended.push(bible)
                    newSorted.pop()
                }
            })
            sortedBibles = newSorted
            recommended = recommended
        }
    }

    type ChurchAppsApiBible = {
        id: string // not needed
        abbreviation: string
        name: string
        nameLocal: string
        description: string | null
        source: "api.bible"
        sourceKey: string // id
        language: string // "eng"
        copyright: string
        attributionRequired: boolean
        attributionString?: string
    }

    function toggleScripture({ sourceKey: id, name, copyright, attributionRequired, attributionString }: ChurchAppsApiBible) {
        scriptures.update((a: any) => {
            let key: string | null = null
            Object.entries(a).forEach(([sId, value]: any) => {
                if (value.id === id) key = sId
            })

            if (key) delete a[key]
            else a[uid()] = { name, api: true, id, copyright, attributionRequired, attributionString } as BibleCategories
            return a
        })
    }

    $: searchedBibles = sortedBibles
    $: searchedRecommendedBibles = recommended
    function search(e: any) {
        let value = e.detail.toLowerCase()

        if (value.length < 2) {
            searchedBibles = sortedBibles
            searchedRecommendedBibles = recommended
            return
        }

        searchedBibles = sortedBibles.filter((a) => value.split(" ").find((value) => a.name.toLowerCase().includes(value)))
        searchedRecommendedBibles = recommended.filter((a) => value.split(" ").find((value) => a.name.toLowerCase().includes(value)))
    }

    let searchActive = false
    $: if (importType === "" && searchActive) searchActive = false

    let importType = ""
    const importTypes = [
        { id: "api", name: "API", icon: "web" }, // translate | scripture_alt
        { id: "local", name: translateText("cloud.local"), icon: "scripture" }
    ]

    function goBack() {
        if (importType === "api" && searchActive && (document.getElementById("scriptureApiSearchInput") as any)?.value) {
            searchActive = false
            searchedBibles = sortedBibles
            searchedRecommendedBibles = recommended
            return
        }

        importType = ""
    }
</script>

{#if importType}
    <MaterialButton class="popup-back" icon="back" iconSize={1.3} title="actions.back" on:click={goBack} />
{/if}

{#if importType === "api"}
    {#if error}
        <T id="error.bible_api" />
    {:else}
        <div style="display: flex;align-items: center;justify-content: space-between;">
            <h2>
                <T id="scripture.bibles" />
            </h2>

            {#if searchActive}
                <MaterialTextInput label="main.search" id="scriptureApiSearchInput" style="width: 50%;" value="" on:input={search} autofocus />
            {:else}
                <MaterialButton class="search" style="border-bottom: 2px solid var(--secondary);font-weight: normal;padding: 11px 15px;" on:click={() => (searchActive = true)}>
                    <Icon id="search" size={1.4} white />
                    {#if !$labelsDisabled}<p style="opacity: 0.8;font-size: 1.1em;"><T id="main.search" /></p>{/if}
                </MaterialButton>
            {/if}
        </div>
        <div class="list">
            {#if searchedRecommendedBibles.length}
                {#each searchedRecommendedBibles as bible}
                    <MaterialButton icon="scripture_alt" on:click={() => toggleScripture({ ...bible, name: bible.nameLocal || bible.name })} isActive={!!Object.values($scriptures).find((a) => a.id === bible.sourceKey)}>
                        {bible.nameLocal || bible.name}
                        {#if bible.description && bible.description.toLowerCase() !== "common" && !(bible.nameLocal || bible.name).includes(bible.description)}
                            <span class="description" data-title={bible.description}>{bible.description}</span>
                        {/if}
                    </MaterialButton>
                {/each}
                <hr />
            {/if}
            {#if sortedBibles.length}
                {#if searchedBibles.length}
                    {#each searchedBibles as bible}
                        <MaterialButton icon="scripture_alt" on:click={() => toggleScripture(bible)} isActive={!!Object.values($scriptures).find((a) => a.id === bible.sourceKey)}>
                            {bible.name}
                            {#if bible.description && bible.description.toLowerCase() !== "common" && !bible.name.includes(bible.description)}
                                <span class="description" data-title={bible.description}>{bible.description}</span>
                            {/if}
                        </MaterialButton>
                    {/each}
                {:else}
                    <Center faded>
                        <T id="empty.search" />
                    </Center>
                {/if}
            {:else}
                <Center>
                    <Loader />
                </Center>
            {/if}
        </div>
    {/if}
{:else if importType === "local"}
    <p style="font-size: 1.1em;"><T id="scripture.supported_formats" /></p>
    <ul style="list-style: inside;">
        <li>
            <span style="font-size: 0.9em;font-weight: bold;">XML</span>
            <span style="font-size: 0.8em;opacity: 0.8;margin-left: 10px;">Zefania/OSIS/Beblia/OpenSong</span>
        </li>
        <li>
            <span style="font-size: 0.9em;font-weight: bold;">JSON</span>
            <span style="font-size: 0.8em;opacity: 0.8;margin-left: 10px;">FreeShow</span>
        </li>
    </ul>

    <p style="margin: 20px 0;opacity: 0.9;">Find some available <Link url="https://freeshow.app/resources#scriptures">Bible versions</Link>.</p>

    <MaterialButton variant="outlined" icon="import" on:click={() => sendMain(Main.IMPORT, { channel: "BIBLE", format: { name: "Bible", extensions: ["xml", "xmm", "json", "fsb"] } })}>
        <T id="scripture.local" />
    </MaterialButton>
{:else}
    <MaterialMultiChoice options={importTypes} on:click={(e) => (importType = e.detail)} />
{/if}

<style>
    .list {
        display: flex;
        flex-direction: column;
        max-height: 55vh;
        margin: 15px 0;
        overflow: auto;

        background-color: var(--primary-darker);
        border-radius: 8px;
        padding: 10px 0;
    }
    /* .list :global(button:nth-child(odd)) {
        background-color: var(--primary-darkest) !important;
    } */

    .list :global(button) {
        justify-content: start;
        font-weight: normal;

        line-height: 1.5em;

        border-radius: 0;
        cursor: pointer;
        padding: 16px 20px;
    }

    hr {
        border: 1px solid var(--primary-lighter);
        margin: 20px 0;
    }

    h2 {
        color: var(--text);
        font-size: 1.1em;
    }

    .description {
        opacity: 0.5;
        font-style: italic;
        margin-inline-start: 10px;

        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }
</style>
