<script lang="ts">
    import { activeEdit, activeProject, activeShow, categories, notFound, outLocked, outputs, playerVideos, playingAudio, projects, shows, showsCache } from "../../stores"
    import { playAudio } from "../helpers/audio"
    import { historyAwait } from "../helpers/history"
    import Icon from "../helpers/Icon.svelte"
    import { getFileName, removeExtension } from "../helpers/media"
    import { findMatchingOut, getActiveOutputs, setOutput } from "../helpers/output"
    import { checkName } from "../helpers/show"
    import { swichProjectItem, updateOut } from "../helpers/showActions"
    import { _show } from "../helpers/shows"
    import Button from "./Button.svelte"
    import HiddenInput from "./HiddenInput.svelte"

    export let id: string
    export let show: any = {}
    export let data: null | string = null
    export let index: null | number = null
    $: type = show.type || "show"
    $: name = type === "show" ? $shows[show.id]?.name : type === "player" ? ($playerVideos[id] ? $playerVideos[id].name : setNotFound(id)) : show.name
    // export let page: "side" | "drawer" = "drawer"
    export let match: null | number = null
    // TODO: svelte animate
    // search
    $: style = match !== null ? `background: linear-gradient(to right, var(--secondary-opacity) ${match}%, transparent ${match}%);` : ""

    function setNotFound(id: string) {
        notFound.update((a) => {
            a.show.push(id)
            return a
        })
        return id
    }

    $: newName = name === null && (type === "image" || type === "video") ? removeExtension(getFileName(id)) : name || ""

    // TODO: set name when show does not exist

    // export let location;
    // export let access;

    export let icon: boolean = false
    let iconID: null | string = null
    let custom: boolean = false
    $: {
        if (icon) {
            custom = false
            if (type === "show") {
                if ($shows[show.id]?.private) iconID = "private"
                else if ($shows[show.id]?.category && $categories[$shows[show.id].category || ""]) {
                    custom = true
                    iconID = $categories[$shows[show.id].category || ""].icon || null
                } else iconID = "noIcon"
            } else if (type === "audio") iconID = "music"
            // else if (type === "player") iconID = "live"
            else iconID = type
        }
    }
    // export let category: string
    // const check = () => {
    //   if (!category[1]) return category[0]
    //   // else if (category[0].toLowerCase().includes('song') || category[0].toLowerCase().includes('music')) return 'song';
    //   else if (category[0].toLowerCase().includes("info") || category[0].toLowerCase().includes("presentation")) return "presentation"
    //   else return "song"
    // }
    // $: icon = check()
    $: active = index !== null ? $activeShow?.index === index : $activeShow?.id === id

    let editActive: boolean = false
    function click(e: any) {
        if (editActive) return

        // set active show
        let pos = index
        if (index === null && $activeProject !== null) {
            let i = $projects[$activeProject].shows.findIndex((p) => p.id === id)
            if (i > -1) pos = i
        }

        if (e.ctrlKey || e.metaKey || active || e.target.closest("input")) return

        let newShow: any = { id, type }

        if (pos !== null) {
            newShow.index = pos
            if (type === "audio") newShow.name = show.name
            else if ($showsCache[id]) swichProjectItem(pos, id)
        }

        activeShow.set(newShow)
        if (type === "image" || type === "video") activeEdit.set({ id, type: "media", items: [] })
        else if ($activeEdit.id) activeEdit.set({ type: "show", slide: 0, items: [] })
    }

    function doubleClick(e: any) {
        if (editActive || $outLocked || e.target.closest("input")) return

        let currentOutput: any = getActiveOutputs()[0]
        let slide: any = currentOutput.out?.slide || null

        if (type === "show" && $showsCache[id] && $showsCache[id].layouts[$showsCache[id].settings.activeLayout].slides.length) {
            updateOut("active", 0, _show("active").layouts("active").ref()[0], !e.altKey)
            if (slide?.id === id && slide?.index === 0 && slide?.layout === $showsCache[id].settings.activeLayout) return
            setOutput("slide", { id, layout: $showsCache[id].settings.activeLayout, index: 0 })
        } else if (type === "image" || type === "video") {
            // WIP duplicate of Show.svelte - onVideoClick
            let out: any = { path: id, muted: show.muted || false, loop: show.loop || false, startAt: 0, type: type }
            if (index && $activeProject) {
                let styling = $projects[$activeProject].shows[index]
                if (styling.filter) out.filter = styling.filter
                // TODO: flipped, fit, speed
                // if (styling.flipped) out.flipped = styling.flipped
                // if (styling.fit) out.fit = styling.fit
            }

            // remove active slide
            if ($activeProject && $projects[$activeProject].shows.find((a) => a.id === out.path)) setOutput("slide", null)

            setOutput("background", out)
        } else if (type === "audio") playAudio({ path: id, name: show.name })
        else if (type === "player") setOutput("background", { id, type: "player" })
    }

    function rename(e: any) {
        historyAwait([id], { id: "SHOWS", newData: { data: [{ id, show: { name: checkName(e.detail.value) } }], replace: true }, location: { page: "drawer" } })
    }

    let activeOutput: any = null
    $: if ($outputs) activeOutput = findMatchingOut(id)
    // $: if (activeOutput) style += "outline-offset: -2px;outline: 2px solid " + activeOutput + ";"
</script>

<div {id} class="main">
    <!-- <span style="background-image: url(tutorial/icons/{type}.svg)">{newName}</span> -->
    <!-- WIP padding-left: 0.8em; -->
    <Button on:click={click} on:dblclick={doubleClick} {active} outlineColor={activeOutput} outline={activeOutput !== null || $playingAudio[id]} class="context {$$props.class}" {style} bold={false} border red={$notFound.show?.includes(id)}>
        <span style="display: flex;align-items: center;flex: 1;overflow: hidden;">
            {#if iconID}
                <Icon id={iconID} {custom} right />
            {/if}
            <!-- <p style="margin: 5px;">{newName}</p> -->
            <HiddenInput value={newName} id={index !== null ? "show_" + id + "#" + index : "show_drawer_" + id} on:edit={rename} bind:edit={editActive} allowEmpty={false} allowEdit={!show.type || show.type === "show"} />
            {#if show.layoutInfo?.name}
                <span class="layout">{show.layoutInfo.name}</span>
            {/if}
        </span>

        {#if match}
            <span style="opacity: 0.8;padding-left: 10px;">
                {match}%
            </span>
        {/if}

        {#if data}
            <span style="opacity: 0.5;padding-left: 10px;">{data}</span>
        {/if}
    </Button>
</div>

<style>
    .main :global(button) {
        width: 100%;
        justify-content: space-between;
        padding: 0.15em 0.8em;
    }
    .main :global(button p) {
        margin: 3px 5px;
    }

    .layout {
        opacity: 0.6;
        font-style: italic;
        font-size: 0.9em;
        padding-left: 5px;

        /* overflow: hidden;
        text-overflow: ellipsis; */
        white-space: nowrap;
        max-width: 40%;
    }
</style>
