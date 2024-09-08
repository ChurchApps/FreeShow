<script lang="ts">
    import { activePopup, activeProject, dictionary, projects, projectView, version } from "../../stores"
    import { history } from "../helpers/history"
    import Icon from "../helpers/Icon.svelte"
    import T from "../helpers/T.svelte"
    import Button from "../inputs/Button.svelte"
    import Link from "../inputs/Link.svelte"
    import Center from "../system/Center.svelte"

    function createProject() {
        // if opened project is empty go to project list (to reduce confusion)
        if ($projects[$activeProject || ""]?.shows?.length === 0) {
            activeProject.set(null)
            projectView.set(true)
        }

        history({ id: "UPDATE", location: { page: "show", id: "project" } })
    }
</script>

<Center>
    <h1>FreeShow</h1>
    <p style="opacity: 0.8;">v{$version}</p>
    <p style="padding: 30px">
        <Link url="https://freeshow.app/docs">
            <T id="main.docs" />
            <Icon id="launch" white />
        </Link>
    </p>

    <span class="buttons">
        <Button on:click={createProject} title={$dictionary.tooltip?.project} dark>
            <Icon id="project" right />
            <p><T id="new.project" /></p>
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
            <Icon id="add" right />
            <p><T id="new.show" /></p>
        </Button>
    </span>
</Center>

<style>
    h1 {
        font-size: 4em;
        overflow: initial;
    }

    p {
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

    @media screen and (max-height: 500px) {
        h1 {
            font-size: 3em;
        }
    }
    @media screen and (max-height: 400px) {
        h1 {
            font-size: 2em;
        }
    }
    @media screen and (max-width: 800px) {
        h1 {
            font-size: 2em;
        }
    }
</style>
