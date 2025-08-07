<script lang="ts">
    import { activePopup, activeProject, dictionary, projects, projectView, showRecentlyUsedProjects, shows, special, version } from "../../stores"
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

        showRecentlyUsedProjects.set(false)
    }

    let links: string[] = []
    function extractLinksAndCleanText(text: string) {
        links = []

        // extract and remove links from <a> tags
        const textWithoutATags = text.replace(/<a\s[^>]*href=["'](https?:\/\/[^"']+)["'][^>]*>.*?<\/a>/gi, (_match, url) => {
            links.push(url)
            return ""
        })
        // extract and remove raw links from plain text
        const finalText = textWithoutATags.replace(/https?:\/\/[^\s<>"']+/gi, (url) => {
            links.push(url)
            return ""
        })

        return finalText.replaceAll("\n", "<br>").replace(/\s+/g, " ").trim()
    }
</script>

<Center class="context #splash">
    <h1>FreeShow</h1>
    <p style="opacity: 0.7;">v{$version}</p>
    {#if $special.splashText}
        <p style="padding-top: 30px">
            {@html extractLinksAndCleanText($special.splashText)}
            <span class="links" style="display: flex;flex-direction: column;align-items: center;">
                {#each links as link}
                    <Link url={link}>
                        {link.replace(/^(https?:\/\/)/, "")}
                        <Icon id="launch" white />
                    </Link>
                {/each}
            </span>
        </p>
    {:else if Object.keys($shows).length < 20}
        <!-- shows up for new users (can be found in "About" menu) -->
        <p style="padding-top: 30px">
            <Link url="https://freeshow.app/docs">
                <T id="main.docs" />
                <Icon id="launch" white />
            </Link>
        </p>
    {/if}

    <span style="padding-top: 30px" class="buttons">
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
