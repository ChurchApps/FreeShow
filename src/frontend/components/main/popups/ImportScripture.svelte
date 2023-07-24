<script lang="ts">
    import { onMount } from "svelte"
    import { uid } from "uid"
    import { IMPORT } from "../../../../types/Channels"
    import { activePopup, alertMessage, bibleApiKey, dictionary, language, os, scriptures } from "../../../stores"
    import { replace } from "../../../utils/languageData"
    import { send } from "../../../utils/request"
    import Icon from "../../helpers/Icon.svelte"
    import T from "../../helpers/T.svelte"
    import Button from "../../inputs/Button.svelte"
    import TextInput from "../../inputs/TextInput.svelte"
    import Center from "../../system/Center.svelte"
    import Loader from "../Loader.svelte"

    // API.Bible key. Will propably change in the future (Please don't abuse)
    let key: string = "320b5b593fa790ced135a98861de51a9"
    let error: null | string = null
    let bibles: any[] = []

    onMount(fetchBibles)

    async function fetchBibles() {
        const api = "https://api.scripture.api.bible/v1/bibles"
        fetch(api, { headers: { "api-key": key } })
            .then((response) => response.json())
            .then((data) => {
                console.log({ ...data.data })
                bibles = data.data
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
            sortedBibles = bibles.sort((a, b) => a.name.localeCompare(b.name))
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

    const formats: any = [
        { name: "Zefania", extensions: ["xml"], id: "zefania" }, // OSIS
        { name: "beblia.com", extensions: ["xml"], id: "beblia" },
        { name: "OpenSong", extensions: ["xml", "xmm"], id: "opensong" },
        { name: "FreeShow", extensions: ["fsb", "json"], id: "freeshow" },
    ]

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
</script>

{#if error}
    <T id="error.bible_api" />
{:else}
    <div style="display: flex;justify-content: space-between;">
        <h2>
            <T id="scripture.bibles" />
        </h2>
        {#if $bibleApiKey}
            <TextInput style="width: 50%;" placeholder={$dictionary.main?.search} value="" on:input={search} />
        {/if}
    </div>
    <div class="list">
        <!-- <BibleApiKey /> -->

        {#if $bibleApiKey}
            {#if searchedRecommendedBibles.length}
                {#each searchedRecommendedBibles as bible}
                    <Button bold={false} on:click={() => toggleScripture(bible)} active={!!Object.values($scriptures).find((a) => a.id === bible.id)}>
                        <Icon id="noIcon" right />{bible.nameLocal}
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
                            <Icon id="noIcon" right />{bible.name}
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
        {/if}
    </div>
{/if}

<h2>
    <T id="scripture.custom" />
</h2>

<span style="display: flex;">
    {#each formats as format}
        <!-- style="width: 20%;flex-direction: column;min-height: 160px;" -->
        <Button
            style="width: 25%;flex-direction: column;min-height: 180px;"
            on:click={() => {
                send(IMPORT, [format.id + "_bible"], format)

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
            <img src="./import-logos/{format.icon || format.id}.webp" alt="{format.id}-logo" />
            <p>{format.name}</p>
        </Button>
    {/each}
</span>

<style>
    .list {
        display: flex;
        flex-direction: column;
        max-height: 40vh;
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
