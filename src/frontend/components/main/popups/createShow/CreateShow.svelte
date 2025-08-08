<script lang="ts">
    import { ShowObj } from "../../../../classes/Show"
    import { convertText, getQuickExample, trimNameFromString } from "../../../../converters/txt"
    import { activePopup, activeProject, activeShow, categories, dictionary, drawerTabsData, formatNewShow, quickTextCache, shows, special, splitLines } from "../../../../stores"
    import { newToast } from "../../../../utils/common"
    import { translate } from "../../../../utils/language"
    import { clone, sortObject } from "../../../helpers/array"
    import { history } from "../../../helpers/history"
    import { checkName } from "../../../helpers/show"
    import T from "../../../helpers/T.svelte"
    import MaterialButton from "../../../inputs/MaterialButton.svelte"
    import MaterialDropdown from "../../../inputs/MaterialDropdown.svelte"
    import MaterialMultiChoice from "../../../inputs/MaterialMultiChoice.svelte"
    import MaterialNumberInput from "../../../inputs/MaterialNumberInput.svelte"
    import MaterialTextarea from "../../../inputs/MaterialTextarea.svelte"
    import MaterialTextInput from "../../../inputs/MaterialTextInput.svelte"
    import MaterialToggleSwitch from "../../../inputs/MaterialToggleSwitch.svelte"
    import List from "../../../input/List.svelte"
    import WebSearch from "./WebSearch.svelte"

    const changeValue = (e: any, key = "text") => {
        values[key] = e.target?.value || e.detail || ""

        // store text if popup is closed
        quickTextCache.set({ name: values.name, text: values.text })
    }
    let storedCache = $quickTextCache.text.length > 20 || $quickTextCache.fromSearch
    let values = {
        text: storedCache ? $quickTextCache.text : "",
        name: storedCache ? $quickTextCache.name : "",
        origin: ""
    }
    if ($quickTextCache.fromSearch) quickTextCache.set({ name: values.name, text: values.text })

    // CATEGORY

    const cats = [
        // { id: "", name: "—" }, // unlabeled
        ...sortObject(
            Object.keys($categories).map((key: string) => ({
                id: key,
                ...$categories[key]
            })),
            "name"
        ).map((cat) => ({
            id: cat.id,
            name: cat.default ? `$:${cat.name}:$` : cat.name
        }))
    ]

    let selectedCategory: any = cats[0]
    // get the selected category
    if ($drawerTabsData.shows?.activeSubTab && $categories[$drawerTabsData.shows.activeSubTab]) selectedCategory = cats.find((a) => a.id === $drawerTabsData.shows.activeSubTab)
    // get the category from the active show
    else if ($shows[$activeShow?.id || ""]?.category) selectedCategory = cats.find((a) => a.id === $shows[$activeShow?.id || ""]?.category)
    // set to "Songs" if it exists & nothing else if selected
    else if ($categories.song) selectedCategory = cats.find((a) => a.id === "song")
    // otherwise set to first category
    else if (cats.length > 1) selectedCategory = cats[1]

    // OPTIONS

    const createOptions = [
        { id: "text", name: translate("create_show.quick_lyrics"), title: `${$dictionary.create_show?.quick_lyrics_tip} [Enter]`, icon: "text" },
        // { id: "clipboard", name: "clipboard", icon: "clipboard" },
        { id: "web", name: translate("create_show.web"), title: `${$dictionary.create_show?.search_web} [Ctrl+F]`, icon: "search" },
        { id: "empty", name: translate("create_show.empty"), title: `${$dictionary.new?.empty_show} [Ctrl+Enter]`, icon: "add" }
    ]
    $: resolvedCreateOptions = clone(createOptions).map((a: any) => {
        if (a.id === "text") a.colored = values.text.length
        if (a.id === "web") a.disabled = !values.name?.trim()
        return a
    })

    let selectedOption = ""
    function selectOption(id: string) {
        if (id === "empty") {
            values.text = ""
            values.origin = ""
            textToShow()
        } else {
            selectedOption = id

            // look for existing shows with the same title
            if (values.name) {
                const exists = Object.values($shows).find((a) => a?.name?.toLowerCase() === values.name.toLowerCase())
                if (exists) newToast("$create_show.exists")
            }
        }
    }

    // WEB SEARCH

    function updateLyrics(e: any) {
        let data = e.detail || {}
        if (!data.lyrics) {
            selectedOption = ""
            return
        }

        // if name is lowercase, replace it
        if (data.title && values.name.toLowerCase() === values.name) {
            values.name = data.title
        }

        values.text = data.lyrics

        const metadata: string[] = []
        if (data.title) metadata.push(`Title=${data.title}`)
        if (data.artist) metadata.push(`Artist=${data.artist}`)
        if (metadata.length) values.text = `${metadata.join("\n")}\n\n${values.text}`

        if (data.source) values.origin = data.source.toLowerCase()
        selectedOption = "text"
    }

    // CREATE

    let showMore = false

    function textToShow() {
        let text = values.text
        if (typeof text !== "string") text = ""

        let sections = text.split("\n\n").filter((a) => a.length)

        // let metaData: string = ""
        // if (sections[1] && sections[0]?.split("\n").length < 3) metaData = sections.splice(0, 1)[0]
        let category = selectedCategory?.id?.length ? selectedCategory.id : null

        if (sections.length) {
            convertText({ name: values.name, category, text, origin: values.origin })
        } else {
            let show = new ShowObj(false, category)
            show.name = checkName(values.name)
            history({ id: "UPDATE", newData: { data: show, remember: { project: $activeProject } }, location: { page: "show", id: "show" } })
        }

        values = { name: "", text: "", origin: "" }
        quickTextCache.set({ name: "", text: "" })
        activePopup.set(null)
    }

    // SHORTCUTS

    function keydown(e: KeyboardEvent) {
        const ctrl = e.ctrlKey || e.metaKey
        if (e.key === "f" && ctrl) {
            e.preventDefault()
            selectOption("web")

            return
        }

        if (e.key === "Enter") {
            if (!ctrl && e.target?.closest(".edit") && !document.activeElement?.closest("#name")) return

            e.preventDefault()
            if (e.target?.closest("button")) return

            if (!ctrl) {
                selectOption("text")
                return
            }

            ;(document.activeElement as any)?.blur()
            textToShow()
        }
    }

    function getName(values) {
        if (values.name) return values.name
        // WIP get from "title" metadata
        if (values.text.trim().length) return trimNameFromString(values.text)
        return $dictionary.main?.unnamed
    }
</script>

<svelte:window on:keydown={keydown} />

{#if !selectedOption}
    <List bottom={20}>
        <MaterialTextInput id="name" label="show.name" autofocus value={values.name} on:input={(e) => changeValue(e, "name")} />
        <MaterialDropdown label="show.category" value={selectedCategory?.id} options={cats.map((a) => ({ label: translate(a.name, { parts: true }), value: a.id }))} on:change={(e) => (selectedCategory = cats.find((a) => a.id === e.detail))} />
    </List>

    <MaterialMultiChoice options={resolvedCreateOptions} on:click={(e) => selectOption(e.detail)} />
{:else}
    <MaterialButton class="popup-back" icon="back" iconSize={1.3} title="actions.back" on:click={() => (selectedOption = "")} />
{/if}

{#if selectedOption === "text"}
    <MaterialButton class="popup-options {showMore ? 'active' : ''}" icon="options" iconSize={1.3} title="edit.options" on:click={() => (showMore = !showMore)}>
        {#if Number($splitLines)}<span class="state">{$splitLines}</span>{/if}
    </MaterialButton>

    <MaterialTextarea label="create_show.quick_lyrics" placeholder={getQuickExample()} value={values.text} autofocus={!values.text} on:input={(e) => changeValue(e)} />
    <!-- WIP buttons for paste / format(remove chords, remove empty lines), etc. -->

    {#if showMore}
        <List top={5}>
            <MaterialToggleSwitch label="create_show.auto_groups" checked={$special.autoGroups !== false} on:change={(e) => special.set({ ...$special, autoGroups: e.detail })} />
            <MaterialToggleSwitch label="create_show.format_new_show" checked={$formatNewShow} on:change={(e) => formatNewShow.set(e.detail)} />
            <MaterialNumberInput label="create_show.split_lines" value={$splitLines} max={100} on:change={(e) => splitLines.set(e.detail)} />
        </List>
    {/if}

    <MaterialButton
        on:click={textToShow}
        variant="contained"
        title="timer.create [Ctrl+Enter]"
        disabled={values.text.trim().length === 0}
        info={getName(values)}
        style="width: 100%;margin-top: 20px;"
        icon="add"
        data-testid="create.show.popup.new.show"
    >
        <T id="timer.create" />
    </MaterialButton>
{:else if selectedOption === "web"}
    <WebSearch query={values.name} on:update={updateLyrics} />
{/if}
