<script lang="ts">
    import type { SettingsTabs } from "../../../types/Tabs"
    import { activePage, focusMode, settingsTab } from "../../stores"
    import Icon from "../helpers/Icon.svelte"
    import T from "../helpers/T.svelte"
    import Button from "../inputs/Button.svelte"

    const tabs: SettingsTabs[] = ["general", "display_settings", "styles", "connection", "files", "theme", "other"]

    function keydown(e: KeyboardEvent) {
        if (e.target?.closest(".edit") || e.ctrlKey || e.metaKey) return

        let nextTab = -1
        let currentTabIndex = tabs.findIndex((tab) => tab === $settingsTab)

        if (e.key === "ArrowDown") {
            nextTab = Math.min(tabs.length - 1, currentTabIndex + 1)
        } else if (e.key === "ArrowUp") {
            nextTab = Math.max(0, currentTabIndex - 1)
        }

        if (nextTab < 0) return
        settingsTab.set(tabs[nextTab])
    }
</script>

<svelte:window on:keydown={keydown} />

{#if $focusMode}
    <Button on:click={() => activePage.set("show")} center dark>
        <Icon id="back" right />
        <T id="actions.back" />
    </Button>
{/if}

<div class="main">
    {#each tabs as tab}
        <Button id="button" on:click={() => settingsTab.set(tab)} active={$settingsTab === tab} bold={false}>
            <Icon id={tab} right />
            <p style="margin: 5px;"><T id="settings.{tab}" /></p>
        </Button>
    {/each}
</div>

<style>
    .main {
        display: flex;
        flex-direction: column;
        height: 100%;
        overflow: auto;
    }

    .main :global(#button) {
        padding: 0.3em 0.8em;
        width: 100%;
    }

    .main :global(button:nth-child(even)) {
        background-color: rgb(0 0 20 / 0.08);
    }

    .main :global(button.active) {
        background-color: var(--primary-darker);
    }
</style>
