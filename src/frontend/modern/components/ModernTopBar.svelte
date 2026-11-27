<script lang="ts">
    import { activeEdit, activePage, activeProfile, activeProject, activeShow, activeStage, dictionary, os, outputDisplay, outputs, profiles, projects, quickSearchActive, saved, settingsTab, shows, showsCache, special, stageShows } from "../../stores"
    import { translateText } from "../../utils/language"
    import { toggleUIStyle } from "../../utils/interfaceStyle"
    import { toggleOutputs } from "../../components/helpers/output"
    import { getEditDisabled, openPage } from "../../components/main/navigation"
    import Icon from "../../components/helpers/Icon.svelte"
    import Button from "./ui/Button.svelte"
    import Kbd from "./ui/Kbd.svelte"

    const pages = [
        { id: "show" as const, icon: "show", key: 1 },
        { id: "edit" as const, icon: "edit", key: 2 },
        { id: "stage" as const, icon: "stage", key: 3 },
        { id: "draw" as const, icon: "draw", key: 4 },
        { id: "settings" as const, icon: "settings", key: 5 }
    ]

    $: profile = $profiles[$activeProfile || ""]
    $: editDisabled = getEditDisabled($activeEdit, $activeShow, $shows, profile)
    $: profileName = $activeProfile === null ? translateText("profile.admin", $dictionary) : profile?.name || ""
    $: profileInitial = profileName ? profileName.charAt(0).toUpperCase() : "A"

    $: physicalOutputWindows = Object.values($outputs).filter((a) => a.enabled && !a.invisible)
    $: outputDisabled = (!$outputDisplay && !physicalOutputWindows.length) || disableClick
    $: live = $outputDisplay

    // the store reads happen inside getContext, so list them to make the statement reactive
    $: context = getContext($activePage, $activeProject, $activeShow, $settingsTab, $activeStage, $projects, $shows, $showsCache, $stageShows)
    $: shortcut = $os.platform === "darwin" ? "⌘G" : "Ctrl G"

    let confirm = false
    let disableClick = false
    let cancelConfirmTimeout: NodeJS.Timeout | null = null

    function getContext(..._dependencies: any[]) {
        if ($activePage === "settings") return translateText(`settings.${$settingsTab}`, $dictionary)
        if ($activePage === "stage") return $stageShows[$activeStage.id || ""]?.name || ""
        if ($activePage === "draw") return ""

        const projectName = $activeProject ? $projects[$activeProject]?.name : ""
        const showId = $activeShow?.id || ""
        const showName = $activeShow?.name || $showsCache[showId]?.name || $shows[showId]?.name || ""
        return [projectName, showName].filter(Boolean).join("  ›  ")
    }

    function pageTitle(id: string) {
        const key = pages.find((a) => a.id === id)?.key
        return `${translateText(`menu._title_${id}`, $dictionary)}${$special.numberKeys ? "" : ` [${key}]`}`
    }

    function toggleOutput(e: MouseEvent) {
        if (cancelConfirmTimeout) clearTimeout(cancelConfirmTimeout)

        const forceKey = e?.ctrlKey || e?.metaKey

        if (!$outputDisplay || confirm) {
            if (confirm) {
                // prevent displaying just after close
                disableClick = true
                setTimeout(() => (disableClick = false), 800)
            }

            confirm = false
            toggleOutputs(null, { force: forceKey })
            return
        }

        if (forceKey) return

        confirm = true
        cancelConfirmTimeout = setTimeout(() => {
            confirm = false
        }, 1800)
    }

    function openProfileSettings() {
        settingsTab.set("profiles")
        activePage.set("settings")
    }
</script>

<header class="topbar">
    <div class="start">
        <div class="brand" data-title="FreeShow">
            <img src="./icon.png" alt="FreeShow" draggable={false} />
        </div>
        <span class="wordmark">FreeShow</span>

        {#if !$saved}
            <span class="unsaved" data-title={translateText("main.unsaved", $dictionary)} />
        {/if}

        <nav class="tabs" aria-label="Main navigation">
            {#each pages as page}
                <Button class="tab" variant="ghost" size="sm" active={$activePage === page.id} disabled={page.id === "edit" && editDisabled} title={pageTitle(page.id)} on:click={() => openPage(page.id)}>
                    <Icon id={page.icon} size={1.05} white />
                    <span class="tabLabel">{translateText(`menu.${page.id}`, $dictionary)}</span>
                </Button>
            {/each}
        </nav>

        {#if context}
            <span class="context" data-title={context}>{context}</span>
        {/if}
    </div>

    <div class="actions">
        <button class="search" type="button" on:click={() => quickSearchActive.set(true)}>
            <Icon id="search" size={0.95} white />
            <span class="searchLabel">{translateText("main.quick_search", $dictionary)}</span>
            <Kbd>{shortcut}</Kbd>
        </button>

        {#if live}
            <span class="onAir" data-title={translateText("menu._title_display_stop", $dictionary)}>
                <span class="liveDot" />
                {translateText("main.on_air", $dictionary)}
            </span>
        {/if}

        <Button class="present" variant={live ? "danger" : "primary"} size="md" disabled={outputDisabled} title={confirm ? "menu.again_confirm" : live ? "menu._title_display_stop" : "menu._title_display"} on:click={(event) => toggleOutput(event.detail)}>
            <Icon id={live ? "cancelDisplay" : "display"} size={1.05} white />
            <span class="presentLabel">{live ? (confirm ? translateText("menu.again_confirm", $dictionary) : translateText("media.stop", $dictionary)) : translateText("menu._title_display", $dictionary)}</span>
        </Button>

        <button class="avatar" type="button" data-title={translateText("profile.change_profile", $dictionary)} on:click={openProfileSettings}>
            {#if $activeProfile === null}
                <Icon id="admin" size={1.05} white />
            {:else}
                {profileInitial}
            {/if}
        </button>

        <Button class="styleToggle" variant="ghost" size="icon" title={translateText("settings.ui_style_classic", $dictionary)} on:click={toggleUIStyle}>
            <Icon id="stars" size={1.05} white />
        </Button>
    </div>
</header>

<style>
    .topbar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 14px;

        height: 52px;
        min-height: 52px;
        padding: 0 10px 0 12px;

        background: var(--ui-panel);
        border-bottom: 1px solid var(--ui-border);
        box-shadow: inset 0 1px 0 color-mix(in srgb, var(--text) 6%, transparent);

        z-index: 30;
        -webkit-app-region: drag;
    }

    .topbar :global(button) {
        -webkit-app-region: no-drag;
    }

    .start,
    .actions {
        display: flex;
        align-items: center;
        gap: 8px;
        min-width: 0;
    }

    .brand {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 28px;
        height: 28px;
        flex-shrink: 0;

        border-radius: 8px;
        overflow: hidden;
        box-shadow:
            0 0 0 1px var(--ui-border),
            0 0 16px -6px var(--ui-accent-glow);
    }
    .brand img {
        width: 100%;
        height: 100%;
        object-fit: cover;
    }

    .wordmark {
        margin-inline-end: 6px;

        font-family: var(--ui-font-display);
        font-size: 16px;
        font-weight: 700;
        letter-spacing: 0.005em;
        color: var(--ui-text);
        white-space: nowrap;
    }

    .tabs {
        display: flex;
        align-items: center;
        gap: 2px;
        padding: 3px;

        background: var(--ui-panel-deep);
        border: 1px solid var(--ui-border);
        border-radius: 10px;
    }

    :global(.topbar .tab) {
        position: relative;
        height: 30px;
        padding: 0 11px;
        border-radius: 7px;
        color: var(--ui-muted);
        gap: 6px;
        font-family: var(--ui-font-display);
        font-size: 13px;
        font-weight: 500;
        letter-spacing: 0.015em;
    }

    :global(.topbar .tab.active::after) {
        content: "";
        position: absolute;
        inset-inline: 9px;
        bottom: 3px;
        height: 2px;
        border-radius: 2px;
        background: var(--ui-accent);
        box-shadow: 0 0 8px var(--ui-accent-glow);
    }
    :global(.topbar .tab:hover) {
        color: var(--ui-text);
    }
    :global(.topbar .tab.active) {
        color: var(--ui-text);
        background: var(--ui-accent-soft);
        box-shadow: inset 0 0 0 1px var(--ui-accent-border);
    }
    :global(.topbar .tab.active svg) {
        fill: var(--ui-accent);
    }

    .context {
        margin-inline-start: 6px;
        padding-inline-start: 12px;
        font-size: 12.5px;
        font-weight: 500;
        color: var(--ui-muted);
        border-inline-start: 1px solid var(--ui-border);

        max-width: 32ch;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .unsaved {
        width: 7px;
        height: 7px;
        border-radius: 50%;
        background: var(--ui-accent);
        box-shadow: 0 0 0 3px var(--ui-accent-soft);
        flex-shrink: 0;
    }

    .search {
        display: flex;
        align-items: center;
        gap: 8px;

        height: 32px;
        min-width: 160px;
        padding: 0 6px 0 10px;

        font-family: inherit;
        font-size: 12.5px;
        color: var(--ui-muted);

        background: var(--ui-panel-deep);
        border: 1px solid var(--ui-border);
        border-radius: 8px;

        cursor: pointer;
        transition:
            border-color 0.15s ease,
            color 0.15s ease;
    }
    .search:hover {
        border-color: var(--ui-border-strong);
        color: var(--ui-text);
    }
    .search :global(svg) {
        opacity: 0.55;
    }
    .searchLabel {
        flex: 1;
        min-width: 0;
        text-align: start;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .onAir {
        display: inline-flex;
        align-items: center;
        gap: 6px;

        height: 26px;
        padding: 0 10px;

        font-family: var(--ui-font-display);
        font-size: 10.5px;
        font-weight: 700;
        letter-spacing: 0.14em;
        text-transform: uppercase;
        color: #ffd9e2;
        white-space: nowrap;

        background: color-mix(in srgb, #d92d4b 22%, transparent);
        border: 1px solid color-mix(in srgb, #ff5570 38%, transparent);
        border-radius: 999px;
        box-shadow: 0 0 18px -6px rgb(217 45 75 / 0.8);
    }

    .liveDot {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: #ff5570;
        box-shadow: 0 0 8px #ff5570;
        animation: pulse 1.6s ease-in-out infinite;
    }

    @keyframes pulse {
        0%,
        100% {
            opacity: 1;
        }
        50% {
            opacity: 0.35;
        }
    }

    .avatar {
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;

        width: 30px;
        height: 30px;
        padding: 0;

        font-family: inherit;
        font-size: 12px;
        font-weight: 600;
        color: var(--ui-text);

        background: var(--ui-panel-deep);
        border: 1px solid var(--ui-border);
        border-radius: 50%;

        cursor: pointer;
        transition: background 0.15s ease;
    }
    .avatar:hover {
        background: var(--ui-hover);
    }

    :global(.topbar .styleToggle) {
        color: var(--ui-subtle);
    }
    :global(.topbar .styleToggle:hover) {
        color: var(--ui-text);
    }

    @media screen and (max-width: 1120px) {
        .context {
            display: none;
        }
    }

    @media screen and (max-width: 1120px) {
        .wordmark {
            display: none;
        }
    }

    @media screen and (max-width: 1000px) {
        :global(.topbar .tabLabel) {
            display: none;
        }
        :global(.topbar .tab) {
            width: 30px;
            padding: 0;
        }
        .search {
            min-width: 32px;
        }
        .searchLabel {
            display: none;
        }
    }

    @media screen and (max-width: 720px) {
        .topbar {
            gap: 8px;
            padding: 0 8px;
        }
        .brand {
            display: none;
        }
        :global(.topbar .presentLabel) {
            display: none;
        }
        :global(.topbar .present) {
            width: 34px;
            min-width: 34px;
            padding: 0;
        }
        .avatar,
        :global(.topbar .styleToggle) {
            display: none;
        }
    }
</style>
