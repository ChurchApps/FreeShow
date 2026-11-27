<script lang="ts">
    import { activePopup, activeProject, dictionary, projects, projectView, quickSearchActive, showRecentlyUsedProjects, version } from "../../stores"
    import { translateText } from "../../utils/language"
    import { history } from "../../components/helpers/history"
    import Icon from "../../components/helpers/Icon.svelte"
    import Link from "../../components/inputs/Link.svelte"
    import Kbd from "./ui/Kbd.svelte"

    function createProject() {
        // if opened project is empty go to project list (to reduce confusion)
        if ($projects[$activeProject || ""]?.shows?.length === 0) {
            activeProject.set(null)
            projectView.set(true)
        }

        history({ id: "UPDATE", location: { page: "show", id: "project" } })
        showRecentlyUsedProjects.set(false)
    }

    function createShow(e: MouseEvent) {
        if (e?.ctrlKey || e?.metaKey) {
            history({ id: "UPDATE", newData: { remember: { project: $activeProject } }, location: { page: "show", id: "show" } })
            return
        }

        activePopup.set("show")
    }
</script>

<div class="splash">
    <div class="hero">
        <div class="mark">
            <img src="./icon.png" alt="FreeShow" draggable={false} />
        </div>

        <h1>FreeShow</h1>
        <p class="tagline">{translateText("main.tagline", $dictionary)}</p>

        <div class="meta">
            <span class="version">v{$version}</span>
            <Link url="https://freeshow.app/docs">
                {translateText("main.docs", $dictionary)}
                <Icon id="launch" size={0.8} white />
            </Link>
        </div>
    </div>

    <div class="actions">
        <button class="tile" type="button" on:click={() => quickSearchActive.set(true)}>
            <span class="tileTop">
                <span class="tileIcon"><Icon id="search" size={1.15} white /></span>
                <Kbd>Ctrl G</Kbd>
            </span>
            <span class="tileLabel">{translateText("main.quick_search", $dictionary)}</span>
            <span class="tileMeta">{translateText("main.search_hint", $dictionary)}</span>
        </button>

        <button class="tile" type="button" on:click={createProject}>
            <span class="tileTop">
                <span class="tileIcon"><Icon id="project" size={1.1} white /></span>
            </span>
            <span class="tileLabel">{translateText("new.project", $dictionary)}</span>
            <span class="tileMeta">{translateText("tooltip.project", $dictionary)}</span>
        </button>

        <button class="tile" type="button" on:click={createShow}>
            <span class="tileTop">
                <span class="tileIcon"><Icon id="add" size={1.15} white /></span>
            </span>
            <span class="tileLabel">{translateText("new.show", $dictionary)}</span>
            <span class="tileMeta">{translateText("tooltip.show", $dictionary)}</span>
        </button>
    </div>
</div>

<style>
    .splash {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 38px;

        min-height: 100%;
        padding: 48px 24px;
    }

    .hero {
        display: flex;
        flex-direction: column;
        align-items: center;
        text-align: center;
    }

    .mark {
        display: flex;
        align-items: center;
        justify-content: center;

        width: 48px;
        height: 48px;
        margin-bottom: 16px;

        border-radius: 13px;
        overflow: hidden;
    }
    .mark img {
        width: 100%;
        height: 100%;
        object-fit: cover;
    }

    h1 {
        margin: 0;
        font-family: var(--ui-font);
        font-size: clamp(2.6em, 5vw, 3.6em);
        font-weight: 700;
        letter-spacing: -0.02em;
        line-height: 1;
        color: var(--ui-text);
    }

    .tagline {
        margin: 12px 0 0;
        max-width: 44ch;
        font-size: 0.95em;
        line-height: 1.5;
        color: var(--ui-muted);
        white-space: normal;
    }

    .meta {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-top: 18px;
    }

    .version {
        padding: 3px 8px;

        font-family: var(--ui-font);
        font-size: 0.7em;
        color: var(--ui-subtle);

        background: var(--ui-panel-raised);
        border: 1px solid var(--ui-border);
        border-radius: 999px;
    }

    .actions {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 12px;
        width: min(760px, 100%);
    }

    .tile {
        display: flex;
        flex-direction: column;
        align-items: stretch;
        gap: 10px;

        padding: 15px;

        font-family: inherit;
        text-align: start;
        color: var(--ui-text);

        background: var(--ui-panel);
        border: 1px solid var(--ui-border);
        border-radius: 14px;
        box-shadow: inset 0 1px 0 color-mix(in srgb, var(--text) 6%, transparent);

        cursor: pointer;
        transition:
            transform 0.15s ease,
            border-color 0.15s ease,
            box-shadow 0.15s ease;
    }
    .tile:hover {
        transform: translateY(-2px);
        border-color: var(--ui-accent-border);
    }
    .tile:focus-visible {
        outline: none;
        box-shadow:
            0 0 0 2px var(--ui-panel-deep),
            0 0 0 4px var(--ui-accent-border);
    }

    .tileTop {
        display: flex;
        align-items: center;
        justify-content: space-between;
        color: var(--ui-subtle);
    }

    .tileIcon {
        display: flex;
        align-items: center;
        justify-content: center;

        width: 32px;
        height: 32px;

        color: var(--ui-accent);
        background: var(--ui-accent-soft);
        border: 1px solid var(--ui-accent-border);
        border-radius: 9px;
    }

    .tileLabel {
        font-family: var(--ui-font);
        font-size: 0.9em;
        font-weight: 600;
        letter-spacing: 0.01em;
    }

    .tileMeta {
        font-size: 0.8em;
        line-height: 1.45;
        color: var(--ui-muted);
    }

    @media (max-width: 860px) {
        .actions {
            grid-template-columns: 1fr;
            width: min(360px, 100%);
        }
        .splash {
            gap: 26px;
        }
    }
</style>
