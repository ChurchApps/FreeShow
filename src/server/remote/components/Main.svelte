<script lang="ts">
    import type { TabsObj } from "../../../types/Tabs"
    import Tabs from "../../common/components/Tabs.svelte"
    import { translate } from "../util/helpers"
    import { next, previous } from "../util/output"
    import { send } from "../util/socket"
    import { _set, active, activeProject, activeShow, activeTab, dictionary, outShow, projects, projectsOpened, scriptures, shows } from "../util/stores"
    import Lyrics from "./pages/Lyrics.svelte"
    import Media from "./pages/Media.svelte"
    import Project from "./pages/Project.svelte"
    import Scripture from "./pages/Scripture.svelte"
    import Show from "./pages/Show.svelte"
    import Shows from "./pages/Shows.svelte"
    import Slide from "./pages/Slide.svelte"
    import TabletMode from "./tablet/TabletMode.svelte"

    $: tab = $activeTab
    $: if (tab) _set("activeTab", tab)

    let tabs: TabsObj = {}
    $: tabs = {
        shows: { name: translate("remote.shows", $dictionary), icon: "search" }, // shows
        scripture: { name: translate("tabs.scripture", $dictionary), icon: "scripture" },
        project: { name: translate("remote.project", $dictionary), icon: "project" },
        show: { name: translate("remote.show", $dictionary), icon: "show" },
        slide: { name: translate("remote.slide", $dictionary), icon: "display_settings" }, // slide
        // lyrics: { name: translate("remote.lyrics", $dictionary), icon: "lyrics" },
    }
    $: tabsDisabled = {
        shows: $shows.length,
        scripture: Object.keys($scriptures).length,
        project: $projects.length || $activeProject,
        show: $activeShow || ($active?.type || "show") !== "show",
        slide: $outShow,
        lyrics: $outShow,
    }

    // keyboard shortcuts
    function keydown(e: any) {
        if (e.target?.closest("textarea") || e.target?.closest("input")) return

        if ([" ", "Arrow", "Page"].includes(e.key)) e.preventDefault()

        // WIP keyboard shortcuts same as main app
        if ([" ", "ArrowRight", "PageDown"].includes(e.key)) next()
        else if (["ArrowLeft", "PageUp"].includes(e.key)) previous()
        else if (e.key === "Escape") send("API:clear_all")
    }

    // click when focused
    function double(e: any) {
        let id = e.detail
        if (id === "shows") {
            ;(document.querySelector("#showSearch") as any)?.focus()
        } else if (id === "project") {
            _set("projectsOpened", !$projectsOpened)
        } else if (id === "scripture") {
            tab = ""
            setTimeout(() => (tab = "scripture"))
        }
    }
</script>

<svelte:window on:keydown={keydown} />

<section class="tabletMode">
    <TabletMode />
</section>

<section class="phoneMode justify">
    <div class="content">
        {#if tab === "shows"}
            <Shows />
        {:else if tab === "scripture"}
            <Scripture />
        {:else if tab === "project"}
            <Project />
        {:else if tab === "show"}
            {#if ($active.type || "show") === "show"}
                <Show />
            {:else if $active.type === "image" || $active.type === "video"}
                <Media />
            {:else}
                <p style="text-transform: capitalize;">{$active.type}</p>
            {/if}
        {:else if tab === "slide"}
            <Slide />
        {:else if tab === "lyrics"}
            <Lyrics />
        {/if}
    </div>

    <Tabs {tabs} bind:active={tab} disabled={tabsDisabled} on:double={double} />
</section>

<style>
    .content {
        display: flex;
        flex-direction: column;
        flex: 1;
        overflow: hidden;
    }

    .justify {
        height: 100%;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
    }

    .phoneMode {
        display: flex;
    }
    .tabletMode {
        display: none;

        height: 100%;
        justify-content: space-between;
    }

    /* tablet & computers */
    @media only screen and (min-width: 1000px) {
        .phoneMode {
            display: none;
        }
        .tabletMode {
            display: flex;
        }
    }
</style>
