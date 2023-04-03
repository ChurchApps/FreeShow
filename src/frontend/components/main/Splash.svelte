<script lang="ts">
    import { activePopup, activeProject, dictionary, version } from "../../stores"
    import { history } from "../helpers/history"
    import Icon from "../helpers/Icon.svelte"
    import T from "../helpers/T.svelte"
    import Button from "../inputs/Button.svelte"
    import Center from "../system/Center.svelte"
</script>

<Center>
    <h1>FreeShow</h1>
    <p style="padding: 30px">v{$version}</p>

    <span class="buttons">
        <Button on:click={() => history({ id: "UPDATE", location: { page: "show", id: "project" } })} title={$dictionary.tooltip?.project} dark>
            <Icon id="project" right />
            <T id="new.project" />
        </Button>
        <Button
            on:click={(e) => {
                if (e.ctrlKey || e.metaKey) {
                    history({ id: "UPDATE", newData: { remember: { project: $activeProject } }, location: { page: "show", id: "show" } })
                } else activePopup.set("show")
            }}
            title={$dictionary.tooltip?.show}
            dark
        >
            <Icon id="showIcon" right />
            <T id="new.show" />
        </Button>
    </span>
</Center>

<style>
    h1 {
        font-size: 4em;
        overflow: initial;
    }

    p {
        opacity: 0.8;
        overflow: initial;
    }

    .buttons {
        display: flex;
        flex-direction: column;
        gap: 10px;
    }
    .buttons :global(button) {
        background-color: var(--primary);
        /* background-color: var(--secondary);
    color: var(--secondary-text);
    font-size: 1em;
    margin: 10px; */
    }
</style>
