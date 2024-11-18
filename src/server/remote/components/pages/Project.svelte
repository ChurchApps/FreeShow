<script lang="ts">
    import Button from "../../../common/components/Button.svelte"
    import Center from "../../../common/components/Center.svelte"
    import Icon from "../../../common/components/Icon.svelte"
    import { translate } from "../../util/helpers"
    import { send } from "../../util/socket"
    import { _set, activeProject, activeShow, dictionary, shows } from "../../util/stores"
    import ShowButton from "../ShowButton.svelte"
    import Projects from "./Projects.svelte"

    let projects: boolean = false
</script>

{#if $activeProject && !projects}
    {#if $activeProject.shows.length}
        <div class="header" style="padding: 0;">
            <Button on:click={() => (projects = true)}>
                <Icon id="back" size={1.5} />
            </Button>
            <p style="flex: 1;text-align: center;padding: 0.2em 0.8em;">{$activeProject.name}</p>
        </div>

        <div class="scroll">
            {#each $activeProject.shows as show}
                {#if show.type === "section"}
                    <div class="section">{show.name}</div>
                {:else if show.type && show.type !== "show"}
                    <div class="media" style="opacity: 0.5;padding: 5px 22px;text-transform: capitalize;font-size: 0.8em;">{show.type || show.name || show.id}</div>
                {:else if $shows.find((s) => s.id === show.id)}
                    <ShowButton
                        on:click={(e) => {
                            send("SHOW", e.detail)
                            _set("activeTab", "show")
                        }}
                        activeShow={$activeShow}
                        show={$shows.find((s) => s.id === show.id)}
                        icon={$shows.find((s) => s.id === show.id).private ? "private" : $shows.find((s) => s.id === show.id).type ? $shows.find((s) => s.id === show.id).type : "noIcon"}
                    />
                {/if}
            {/each}
        </div>
    {:else}
        <Center faded>{translate("empty.shows", $dictionary)}</Center>
    {/if}
{:else}
    <Projects on:open={() => (projects = false)} />
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
        font-size: 0.9em;
        background-color: var(--primary-darker);
        padding: 2px;
    }
</style>
