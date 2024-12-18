<script lang="ts">
    import { uid } from "uid"
    import { IMPORT } from "../../../../types/Channels"
    import { activePopup, alertMessage, bibleApiKey, dictionary, isDev, labelsDisabled, language, os, scriptures } from "../../../stores"
    import { replace } from "../../../utils/languageData"
    import { send } from "../../../utils/request"
    import { getKey } from "../../../values/keys"
    import { sortByName } from "../../helpers/array"
    import Icon from "../../helpers/Icon.svelte"
    import T from "../../helpers/T.svelte"
    import Button from "../../inputs/Button.svelte"
    import TextInput from "../../inputs/TextInput.svelte"
    import Center from "../../system/Center.svelte"
    import Loader from "../Loader.svelte"

    let error: null | string = null
    let bibles: any[] = []

    $: if (importType === "api") fetchBibles()
    async function fetchBibles() {
        // read cache
        let cache = $isDev ? {} : JSON.parse(localStorage.getItem("scriptureApiCache") || "{}")
        if (cache.date) {
            let cacheDate = new Date(cache.date).getTime()
            let today = new Date().getTime()
            const ONE_MONTH = 2678400000
            // only use cache if it's newer than a month
            if (today - cacheDate < ONE_MONTH) {
                bibles = cache.bibles
                if (bibles) return
            }
        }

        const KEY = $bibleApiKey || getKey("bibleapi")
        const api = "https://api.scripture.api.bible/v1/bibles"
        fetch(api, { headers: { "api-key": KEY } })
            .then((response) => response.json())
            .then((data) => {
                bibles = data.data

                // cache bibles
                let cache = { date: new Date(), bibles }
                localStorage?.setItem("scriptureApiCache", JSON.stringify(cache))
            })
            .catch((e) => {
                console.log(e)
                error = e
            })
    }

    // get list of bibles in language
    let sortedBibles: any[] = []
    let recommended: any[] = []
    $: {
        if (bibles?.length) {
            let langCode = window.navigator.language.slice(-2).toLowerCase()
            sortedBibles = sortByName(bibles)
            let newSorted: any[] = []
            sortedBibles.forEach((bible) => {
                newSorted.push(bible)
                let found = false
                bible.countries.forEach((country: any) => {
                    replace[$language].forEach((r: any) => {
                        r = r.slice(-2)
                        if (!found && (country.id.toLowerCase() === r.toLowerCase() || country.id.toLowerCase() === langCode)) {
                            found = true
                            recommended.push(bible)
                            newSorted.pop()
                        }
                    })
                })
            })
            sortedBibles = newSorted
            recommended = recommended
        }
    }

    function toggleScripture({ id, name }: any) {
        scriptures.update((a: any) => {
            let key: string | null = null
            Object.entries(a).forEach(([sId, value]: any) => {
                if (value.id === id) key = sId
            })

            if (key) delete a[key]
            else a[uid()] = { name, api: true, id }
            return a
        })
    }

    const xmlFormats: any = [
        { name: "Zefania", extensions: ["xml"], icon: "xml", id: "zefania" },
        { name: "OSIS", extensions: ["xml"], icon: "xml", id: "osis" },
        { name: "Beblia", extensions: ["xml"], id: "beblia" },
        { name: "OpenSong", extensions: ["xml", "xmm"], id: "opensong" },
    ]
    const jsonFormats: any = [{ name: "FreeShow", extensions: ["fsb", "json"], icon: "bible_json", id: "freeshow" }]

    $: searchedBibles = sortedBibles
    $: searchedRecommendedBibles = recommended
    function search(e: any) {
        let value = e.target.value.toLowerCase()

        if (value.length < 2) {
            searchedBibles = sortedBibles
            searchedRecommendedBibles = recommended
            return
        }

        searchedBibles = sortedBibles.filter((a) => value.split(" ").find((value) => a.name.toLowerCase().includes(value)))
        searchedRecommendedBibles = recommended.filter((a) => value.split(" ").find((value) => a.name.toLowerCase().includes(value)))
    }

    let searchActive: boolean = false
    $: if (importType === "" && searchActive) searchActive = false

    let importType: string = ""
    const importTypes = [
        { id: "api", name: "API", icon: "web" }, // translate | scripture_alt
        { id: "local", name: "$:cloud.local:$", icon: "scripture" },
    ]
</script>

{#if importType}
    <Button style="position: absolute;left: 0;top: 0;min-height: 58px;" title={$dictionary.actions?.back} on:click={() => (importType = "")}>
        <Icon id="back" size={2} white />
    </Button>
{/if}

{#if importType === "api"}
    {#if error}
        <T id="error.bible_api" />
    {:else}
        <div style="display: flex;justify-content: space-between;">
            <h2>
                <T id="scripture.bibles" />
            </h2>

            {#if searchActive}
                <TextInput style="width: 50%;border-bottom: 2px solid var(--secondary);" placeholder={$dictionary.main?.search} value="" on:input={search} autofocus />
            {:else}
                <Button class="search" style="border-bottom: 2px solid var(--secondary);" on:click={() => (searchActive = true)} bold={false}>
                    <Icon id="search" size={1.4} white right={!$labelsDisabled} />
                    {#if !$labelsDisabled}<p style="opacity: 0.8;font-size: 1.1em;"><T id="main.search" /></p>{/if}
                </Button>
            {/if}
        </div>
        <div class="list">
            <!-- custom key input: -->
            <!-- <BibleApiKey /> -->

            {#if searchedRecommendedBibles.length}
                {#each searchedRecommendedBibles as bible}
                    <Button bold={false} on:click={() => toggleScripture(bible)} active={!!Object.values($scriptures).find((a) => a.id === bible.id)}>
                        <Icon id="scripture_alt" right />{bible.nameLocal}
                        {#if bible.description && bible.description.toLowerCase() !== "common" && !bible.nameLocal.includes(bible.description)}
                            <span class="description" title={bible.description}>({bible.description})</span>
                        {/if}
                    </Button>
                {/each}
                <hr />
            {/if}
            {#if sortedBibles.length}
                {#if searchedBibles.length}
                    {#each searchedBibles as bible}
                        <Button bold={false} on:click={() => toggleScripture(bible)} active={!!Object.values($scriptures).find((a) => a.id === bible.id)}>
                            <Icon id="scripture_alt" right />{bible.name}
                            {#if bible.description && bible.description.toLowerCase() !== "common" && !bible.name.includes(bible.description)}
                                <span class="description" title={bible.description}>({bible.description})</span>
                            {/if}
                        </Button>
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
    <h2>
        <T id="scripture.local" />
    </h2>

    <p style="font-weight: bold;font-size: 0.7em;opacity: 0.8;margin-top: 10px;">XML</p>
    <div class="choose" style="margin-top: 2px;">
        {#each xmlFormats as format}
            <Button
                on:click={() => {
                    send(IMPORT, [format.id + "_bible"], { format })

                    // linux dialog behind window message
                    if ($os.platform === "linux") {
                        alertMessage.set("The file select dialog might appear behind the window on Linux!<br>Please check that if you don't see it.")
                        activePopup.set("alert")
                    } else {
                        activePopup.set(null)
                    }
                }}
                bold={false}
                center
            >
                <img src="./import-logos/{format.icon || format.id}.webp" alt="{format.id}-logo" draggable={false} />
                <p>{format.name}</p>
            </Button>
        {/each}
    </div>

    <p style="font-weight: bold;font-size: 0.7em;opacity: 0.8;margin-top: 10px;">JSON</p>
    <div class="choose" style="margin-top: 2px;">
        {#each jsonFormats as format}
            <Button
                style="max-width: calc(25% - 10px);"
                on:click={() => {
                    send(IMPORT, [format.id + "_bible"], { format })

                    // linux dialog behind window message
                    if ($os.platform === "linux") {
                        alertMessage.set("The file select dialog might appear behind the window on Linux!<br>Please check that if you don't see it.")
                        activePopup.set("alert")
                    } else {
                        activePopup.set(null)
                    }
                }}
                bold={false}
                center
            >
                <img style={format.id === "freeshow" ? "padding: 5px;" : ""} src="./import-logos/{format.icon || format.id}.webp" alt="{format.id}-logo" draggable={false} />
                <p>{format.name}</p>
            </Button>
        {/each}
    </div>
{:else}
    <div class="choose">
        {#each importTypes as type, i}
            <Button on:click={() => (importType = type.id)} style={i === 0 ? "border: 2px solid var(--focus);" : ""}>
                <Icon id={type.icon || ""} size={4} white />
                <p>
                    {#if type.name.includes("$:")}<T id={type.name} />{:else}{type.name}{/if}
                </p>
            </Button>
        {/each}
    </div>
{/if}

<style>
    .choose {
        width: 100%;
        display: flex;
        align-self: center;
        justify-content: space-between;
        gap: 10px;
    }

    .choose :global(button) {
        width: 180px;
        height: 180px;

        display: flex;
        gap: 10px;
        flex-direction: column;
        justify-content: center;
        flex: 1;
    }
    .choose p {
        display: flex;
        align-items: center;
    }

    .list {
        display: flex;
        flex-direction: column;
        max-height: 55vh;
        margin: 15px 0;
        overflow: auto;
    }

    .list :global(button) {
        line-height: 1.5em;
        cursor: pointer;
        text-align: left;
    }

    hr {
        border: 1px solid var(--primary-lighter);
        margin: 10px 0;
    }

    h2 {
        color: var(--text);
    }

    .description {
        opacity: 0.5;
        font-style: italic;
        margin-left: 10px;

        max-width: 40%;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    img {
        height: 100px;
        padding: 10px;
    }
</style>
