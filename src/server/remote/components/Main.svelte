<script lang="ts">
    import type { TabsObj } from "../../../types/Tabs"
    import Button from "../../common/components/Button.svelte"
    import Icon from "../../common/components/Icon.svelte"
    import Tabs from "../../common/components/Tabs.svelte"
    import Textarea from "../../common/components/Textarea.svelte"
    import TextInput from "../../common/components/TextInput.svelte"
    import { translate } from "../util/helpers"
    import { next, previous } from "../util/output"
    import { send } from "../util/socket"
    import { _set, active, activeProject, activeShow, activeTab, createShow, dictionary, outShow, projects, projectsOpened, scriptures, shows } from "../util/stores"
    import Lyrics from "./pages/Lyrics.svelte"
    import Project from "./pages/Project.svelte"
    import Scripture from "./pages/Scripture.svelte"
    import Show from "./pages/Show.svelte"
    import ShowContent from "./pages/ShowContent.svelte"
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
        slide: { name: translate("remote.slide", $dictionary), icon: "display_settings" } // slide
        // lyrics: { name: translate("remote.lyrics", $dictionary), icon: "lyrics" },
    }
    $: tabsDisabled = {
        shows: $shows.length,
        scripture: Object.keys($scriptures).length,
        project: $projects.length || $activeProject,
        show: $activeShow || ($active?.type || "show") !== "show",
        slide: $outShow,
        lyrics: $outShow
    }

    // keyboard shortcuts
    function keydown(e: KeyboardEvent) {
        if ((e.target as HTMLElement)?.closest("textarea") || (e.target as HTMLElement)?.closest("input")) return

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

    let newShowName = ""
    let newShowText = ""
    function newShow() {
        if (!newShowText) {
            newShowFinish()
            return
        }

        send("API:create_show", { text: newShowText, name: newShowName })
        // WIP open show
        newShowFinish()
    }
    const updateName = (e: any) => (newShowName = e.target?.value)

    function newShowFinish() {
        newShowName = ""
        newShowText = ""
        createShow.set(false)
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
            {:else}
                <ShowContent />
            {/if}
        {:else if tab === "slide"}
            <Slide />
        {:else if tab === "lyrics"}
            <Lyrics />
        {/if}
    </div>

    <Tabs {tabs} bind:active={tab} disabled={tabsDisabled} on:double={double} />
</section>

{#if $createShow}
    <div class="fullscreen">
        <div style="display: flex;height: 50px;">
            <Button on:click={() => createShow.set(false)} dark>
                <Icon id="back" size={2} />
            </Button>
            <TextInput placeholder={translate("main.unnamed", $dictionary)} value={newShowName} on:change={updateName} />
        </div>

        <Textarea style="width: 100%;height: calc(100% - 90px - 6px);" bind:value={newShowText} />

        <div style="display: flex;height: 40px;">
            <Button on:click={newShow} style="width: 100%;" center dark>
                <Icon id="add" right />
                <p style="font-size: 0.8em;">{translate("new.show", $dictionary)}</p>
            </Button>
        </div>
    </div>
{/if}

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

    .fullscreen {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;

        background-color: var(--primary);
        z-index: 99;
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
