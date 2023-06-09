<script lang="ts">
    import { MAIN } from "../../../../types/Channels"
    import { ShowObj } from "../../../classes/Show"
    import { convertText } from "../../../converters/txt"
    import { activePopup, activeProject, activeShow, categories, dictionary, drawerTabsData, formatNewShow, shows, splitLines } from "../../../stores"
    import { newToast } from "../../../utils/messages"
    import { receive, send } from "../../../utils/request"
    import { sortObject } from "../../helpers/array"
    import { history } from "../../helpers/history"
    import Icon from "../../helpers/Icon.svelte"
    import { checkName } from "../../helpers/show"
    import T from "../../helpers/T.svelte"
    import Button from "../../inputs/Button.svelte"
    import Checkbox from "../../inputs/Checkbox.svelte"
    import CombinedInput from "../../inputs/CombinedInput.svelte"
    import Dropdown from "../../inputs/Dropdown.svelte"
    import NumberInput from "../../inputs/NumberInput.svelte"
    import TextArea from "../../inputs/TextArea.svelte"
    import TextInput from "../../inputs/TextInput.svelte"
    import Loader from "../Loader.svelte"

    function textToShow() {
        let sections = values.text.split("\n\n").filter((a: any) => a.length)

        // let metaData: string = ""
        // if (sections[1] && sections[0]?.split("\n").length < 3) metaData = sections.splice(0, 1)[0]
        let category = selectedCategory.id.length ? selectedCategory.id : null

        if (sections.length) {
            convertText({ name: values.name, category, text: values.text })
        } else {
            let show = new ShowObj(false, category)
            show.name = checkName(values.name)
            history({ id: "UPDATE", newData: { data: show, remember: { project: $activeProject } }, location: { page: "show", id: "show" } })
        }
        values = { name: "", text: "" }
        activePopup.set(null)
    }

    $: console.log(values.text)

    const changeValue = (e: any, key: string = "text") => (values[key] = e.target.value)
    let values: any = {
        text: "",
        name: "",
    }

    function keydown(e: any) {
        if (e.key !== "Enter" || !(e.ctrlKey || e.metaKey)) return
        ;(document.activeElement as any)?.blur()
        textToShow()
    }

    const cats: any = [
        { id: "", name: "—" },
        ...sortObject(
            Object.keys($categories).map((id) => ({ id, name: $categories[id].default ? `$:${$categories[id].name}:$` : $categories[id].name })),
            "name"
        ),
    ]

    let selectedCategory: any = cats[0]
    // get the selected category
    if ($drawerTabsData.shows?.activeSubTab && $categories[$drawerTabsData.shows.activeSubTab]) selectedCategory = cats.find((a: any) => a.id === $drawerTabsData.shows.activeSubTab)
    // get the category from the active show
    else if ($shows[$activeShow?.id || ""]?.category) selectedCategory = cats.find((a: any) => a.id === $shows[$activeShow?.id || ""]?.category)

    const inputs: any = {
        formatNewShow: (e: any) => formatNewShow.set(e.target.checked),
    }

    let showMore: boolean = false
    let activateLyrics: boolean = false

    let loading = false
    function searchLyrics() {
        let artist = ""
        let title = values.name
        if (!title) return
        send(MAIN, ["SEARCH_LYRICS"], { artist, title })
        loading = true
    }

    receive(MAIN, {
        SEARCH_LYRICS: (data) => {
            loading = false
            if (!data.lyrics) {
                newToast("Could not find lyrics!")
                return
            }

            values.text = data.lyrics
            newToast("Lyrics copied from Google!")
        },
    })
</script>

<svelte:window on:keydown={keydown} />

<CombinedInput>
    <p><T id="show.name" /></p>
    <TextInput autofocus value={values.name} on:change={(e) => changeValue(e, "name")} style="height: 30px;" />
    <div class="search">
        {#if loading}
            <Loader />
        {:else}
            <Button on:click={searchLyrics} title={$dictionary.create_show?.search_web}>
                <Icon id="search" size={1.2} white />
            </Button>
        {/if}
    </div>
</CombinedInput>

<CombinedInput>
    <p><T id="show.category" /></p>
    <Dropdown options={cats} value={selectedCategory.name} on:click={(e) => (selectedCategory = e.detail)} />
</CombinedInput>

<!-- <br /> -->

<Button on:click={() => (showMore = !showMore)} style="margin-top: 10px;" dark center>
    <Icon id="options" right white={showMore} />
    <T id="create_show.more_options" />
</Button>
{#if showMore}
    <CombinedInput>
        <p><T id="create_show.format_new_show" /></p>
        <Checkbox checked={$formatNewShow} on:change={inputs.formatNewShow} />
    </CombinedInput>
    <CombinedInput>
        <p><T id="create_show.split_lines" /></p>
        <NumberInput
            value={$splitLines}
            max={100}
            on:change={(e) => {
                splitLines.set(e.detail)
            }}
        />
    </CombinedInput>
{/if}

<!-- <br /> -->

<Button on:click={() => (activateLyrics = !activateLyrics)} style="margin-top: 10px;" dark center>
    <Icon id="text" right white={activateLyrics} />
    <T id="show.quick_lyrics" />
</Button>

{#if activateLyrics}
    <!-- <span><T id="show.quick_lyrics" /></span> -->
    <TextArea placeholder={$dictionary.create_show?.quick_example} style="height: 250px;min-width: 500px;" value={values.text} on:input={(e) => changeValue(e)} />
{/if}

<Button on:click={textToShow} style="width: 100%;margin-top: 10px;" dark center>
    {#if values.text.trim().length > 0}
        <Icon id="showIcon" right />
        <T id="new.show" />
    {:else}
        <Icon id="showIcon" right white />
        <T id="new.empty_show" />
    {/if}
</Button>

<style>
    .search {
        align-self: center;
    }

    /* loader */
    .search :global(div) {
        width: 25px;
        height: 25px;
    }
</style>
