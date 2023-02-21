<script lang="ts">
    import { MAIN } from "../../../../types/Channels"
    import { ShowObj } from "../../../classes/Show"
    import { convertText } from "../../../converters/txt"
    import { activePopup, activeProject, categories, dictionary, drawerTabsData, formatNewShow, splitLines } from "../../../stores"
    import { receive, send } from "../../../utils/request"
    import { sortObject } from "../../helpers/array"
    import { history } from "../../helpers/history"
    import Icon from "../../helpers/Icon.svelte"
    import { checkName } from "../../helpers/show"
    import T from "../../helpers/T.svelte"
    import Button from "../../inputs/Button.svelte"
    import Checkbox from "../../inputs/Checkbox.svelte"
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
            history({ id: "newShow", newData: { show }, location: { page: "show", project: $activeProject } })
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
    let selectedCategory: any =
        $drawerTabsData.shows?.activeSubTab && $categories[$drawerTabsData.shows.activeSubTab] ? cats.find((a: any) => a.id === $drawerTabsData.shows.activeSubTab) : cats[0]

    const inputs: any = {
        formatNewShow: (e: any) => formatNewShow.set(e.target.checked),
    }

    let showMore: boolean = false

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
            console.log(data.lyrics)
            if (!data.lyrics) return

            values.text = data.lyrics
        },
    })
</script>

<svelte:window on:keydown={keydown} />

<div class="section">
    <p><T id="show.name" /></p>
    <span style="display: flex;width: 50%;">
        <TextInput autofocus value={values.name} on:change={(e) => changeValue(e, "name")} style="height: 30px;" />
        <div class="search">
            {#if loading}
                <Loader />
            {:else}
                <Button on:click={searchLyrics} title="Search the WEB">
                    <Icon id="search" size={1.2} white />
                </Button>
            {/if}
        </div>
    </span>
</div>
<div class="section">
    <p><T id="show.category" /></p>
    <Dropdown options={cats} value={selectedCategory.name} on:click={(e) => (selectedCategory = e.detail)} style="width: 50%;" />
</div>
<br />

<Button on:click={() => (showMore = !showMore)} dark center>
    <Icon id="options" right />
    <T id="create_show.more_options" />
</Button>
{#if showMore}
    <div class="section">
        <p><T id="create_show.format_new_show" /></p>
        <Checkbox checked={$formatNewShow} on:change={inputs.formatNewShow} />
    </div>
    <div class="section">
        <p><T id="create_show.split_lines" /></p>
        <NumberInput
            value={$splitLines}
            max={100}
            buttons={false}
            outline
            on:change={(e) => {
                splitLines.set(e.detail)
            }}
        />
    </div>
{/if}

<br />
<span><T id="show.quick_lyrics" /></span>
<TextArea placeholder={$dictionary.create_show?.quick_example} style="height: 250px;min-width: 500px;" value={values.text} on:input={(e) => changeValue(e)} />
<Button on:click={textToShow} style="width: 100%;margin-top: 10px;color: var(--secondary);" dark center>
    {#if values.text.trim().length > 0}
        <T id="new.show" />
    {:else}
        <T id="new.empty_show" />
    {/if}
</Button>

<style>
    .section {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin: 3px 0;
    }

    .section :global(.dropdown) {
        position: absolute;
        width: 100% !important;
    }

    .section :global(.numberInput input) {
        width: 80px;
        background-color: var(--primary-darker);
    }

    .search {
        align-self: center;
    }

    /* loader */
    .search :global(div) {
        width: 25px;
        height: 25px;
    }
</style>
