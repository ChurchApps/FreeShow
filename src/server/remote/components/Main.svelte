<script lang="ts">
    import { onMount } from "svelte"
    import type { TabsObj } from "../../../types/Tabs"
    import Button from "../../common/components/Button.svelte"
    import Icon from "../../common/components/Icon.svelte"
    import Tabs from "../../common/components/Tabs.svelte"
    import Textarea from "../../common/components/Textarea.svelte"
    import TextInput from "../../common/components/TextInput.svelte"
    import Center from "../../common/components/Center.svelte"
    import Loading from "../../common/components/Loading.svelte"
    import { translate } from "../util/helpers"
    import { send } from "../util/socket"
    import { _set, active, activeProject, activeShow, activeTab, createShow, dictionary, isCleared, outShow, projects, projectsOpened, scriptures, shows } from "../util/stores"

    // Phone mode components (always loaded - small footprint)
    import Lyrics from "./pages/Lyrics.svelte"
    import Project from "./pages/Project.svelte"
    import Scripture from "./pages/Scripture.svelte"
    import Show from "./pages/Show.svelte"
    import ShowContent from "./pages/ShowContent.svelte"
    import Shows from "./pages/Shows.svelte"
    import Slide from "./pages/Slide.svelte"

    // Tablet mode component (lazy-loaded for performance)
    let TabletMode: any = null

    $: tab = $activeTab
    $: if (tab) _set("activeTab", tab)

    let tabs: TabsObj = {}
    $: tabs = {
        shows: { name: translate("remote.shows", $dictionary), icon: "search" },
        scripture: { name: translate("tabs.scripture", $dictionary), icon: "scripture" },
        project: { name: translate("remote.project", $dictionary), icon: "project" },
        show: { name: translate("remote.show", $dictionary), icon: "show" },
        slide: { name: translate("remote.slide", $dictionary), icon: "display_settings" }
    }
    $: tabsDisabled = {
        shows: $shows.length,
        scripture: Object.keys($scriptures).length,
        project: $projects.length || $activeProject,
        show: $activeShow || ($active?.type || "show") !== "show",
        slide: $outShow,
        lyrics: $outShow
    }

    function keydown(e: KeyboardEvent) {
        if ((e.target as HTMLElement)?.closest("textarea") || (e.target as HTMLElement)?.closest("input")) return
        if ([" ", "Arrow", "Page"].includes(e.key)) e.preventDefault()
        if ([" ", "ArrowRight", "PageDown"].includes(e.key)) send("API:next_slide")
        else if (["ArrowLeft", "PageUp"].includes(e.key)) send("API:previous_slide")
        else if (e.key === "Escape") send("API:clear_all")
    }

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
    let previousCreateShow = false
    $: {
        if ($createShow && typeof $createShow === "string" && !previousCreateShow) {
            newShowName = $createShow
        }
        previousCreateShow = !!$createShow
    }
    function newShow() {
        if (!newShowText) {
            newShowFinish()
            return
        }
        send("API:create_show", { text: newShowText, name: newShowName })
        newShowFinish()
    }
    const updateName = (e: any) => (newShowName = e.target?.value)

    function newShowFinish() {
        newShowName = ""
        newShowText = ""
        createShow.set(false)
    }

    let isTablet = false
    let tabletLoading = false

    onMount(() => {
        const media = window.matchMedia("(min-width: 1000px)")
        isTablet = media.matches
        const listener = (e: MediaQueryListEvent) => {
            isTablet = e.matches
            if (e.matches && !TabletMode) loadTabletMode()
        }
        media.addEventListener("change", listener)

        // Load tablet components if needed
        if (isTablet) loadTabletMode()

        return () => media.removeEventListener("change", listener)
    })

    async function loadTabletMode() {
        if (TabletMode || tabletLoading) return
        tabletLoading = true
        const module = await import("./tablet/TabletMode.svelte")
        TabletMode = module.default
        tabletLoading = false
    }
</script>

<svelte:window on:keydown={keydown} />

{#if isTablet}
    <section class="tabletMode">
        {#if TabletMode}
            <svelte:component this={TabletMode} />
        {:else}
            <Center><Loading /></Center>
        {/if}
    </section>
{:else}
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

        <Tabs {tabs} bind:active={tab} disabled={tabsDisabled} on:double={double} noTopRadius={(tab === "show" && ($activeShow?.id === $outShow?.id || !$isCleared.all)) || tab === "slide" || tab === "shows" || tab === "scripture"} />
    </section>
{/if}

{#if $createShow}
    <div class="fullscreen">
        <div style="display: flex;height: 50px;">
            <Button on:click={() => createShow.set(false)} variant="outlined" style="margin-right: 8px;">
                <Icon id="back" size={2} />
            </Button>
            <TextInput placeholder={translate("main.unnamed", $dictionary)} value={newShowName} on:change={updateName} />
        </div>

        <Textarea style="width: 100%;height: calc(100% - 90px - 6px);" bind:value={newShowText} />

        <div style="display: flex;height: 40px;">
            <Button on:click={newShow} variant="contained" style="width: 100%;" center>
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
        min-height: 0;
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
        display: flex;
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
        display: flex;
        flex-direction: column;
        padding: 16px;
        gap: 16px;
    }
</style>
