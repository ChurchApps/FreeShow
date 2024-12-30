<script lang="ts">
    import Button from "../../../common/components/Button.svelte"
    import Center from "../../../common/components/Center.svelte"
    import Icon from "../../../common/components/Icon.svelte"
    import { getFileName, removeExtension } from "../../../common/util/media"
    import { translate } from "../../util/helpers"
    import { send } from "../../util/socket"
    import { _set, active, activeProject, activeShow, dictionary, mediaCache, projectsOpened, shows } from "../../util/stores"
    import ShowButton from "../ShowButton.svelte"
    import Projects from "./Projects.svelte"
</script>

{#if $activeProject && !$projectsOpened}
    <div class="header" style="padding: 0;">
        <Button on:click={() => _set("projectsOpened", true)}>
            <Icon id="back" size={1.5} />
        </Button>
        <p style="flex: 1;text-align: center;padding: 0.2em 0.8em;">{$activeProject.name}</p>
    </div>

    {#if $activeProject.shows?.length}
        <div class="scroll">
            {#each $activeProject.shows as show}
                {@const s = $shows.find((a) => a.id === show.id) || {}}

                {#if show.type === "section"}
                    <div class="section">
                        <p style={show.name ? "" : "opacity: 0.5;"}>{show.name || translate("main.unnamed", $dictionary)}</p>
                    </div>
                {:else if ["image", "video"].includes(show.type)}
                    <Button
                        on:click={() => {
                            _set("active", show)
                            _set("activeTab", "show")
                            if (!$mediaCache[show.path]) send("API:get_thumbnail", { path: show.id })
                        }}
                        active={$active.id === show.id}
                        bold={false}
                        border
                    >
                        <Icon id={show.type} right />
                        <span style="display: flex;align-items: center;flex: 1;overflow: hidden;">
                            <p style="margin: 3px 5px;white-space: nowrap;text-overflow: ellipsis;overflow: hidden;">{show.name || getFileName(removeExtension(show.path || show.id))}</p>
                        </span>
                    </Button>
                {:else if (show.type || "show") !== "show"}
                    <!-- WIP audio / player / PDF / PPT -->
                    <div class="item" style="display: flex;align-items: center;padding: 0.2em 0.8em;">
                        <Icon id={show.type === "audio" ? "music" : show.type} box={show.type === "ppt" ? 50 : 24} right />
                        <p style="font-size: 0.7em;opacity: 0.5;margin: 3px 5px;text-transform: uppercase;font-size: 0.8em;">{show.type}</p>
                    </div>
                {:else if s}
                    <ShowButton
                        on:click={(e) => {
                            _set("active", show)
                            _set("activeTab", "show")
                            send("SHOW", e.detail)
                        }}
                        activeShow={($active.type || "show") === "show" && $activeShow}
                        show={s}
                        icon={s.private ? "private" : s.type || "slide"}
                    />
                    <!-- icon: "song" -->
                {/if}
            {/each}
        </div>
    {:else}
        <Center faded>{translate("empty.shows", $dictionary)}</Center>
    {/if}
{:else}
    <Projects on:open={() => _set("projectsOpened", false)} />
{/if}

<style>
    .scroll {
        display: flex;
        flex-direction: column;
        flex: 1;
        overflow-y: auto;
        overflow-x: hidden;
    }

    /* project */
    .section {
        text-align: center;
        font-size: 0.75em;
        background-color: var(--primary-darker);
        padding: 2px;
    }
</style>
