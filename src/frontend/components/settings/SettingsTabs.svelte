<script lang="ts">
    import type { SettingsTabs } from "../../../types/Tabs"
    import { settingsTab } from "../../stores"
    import Icon from "../helpers/Icon.svelte"
    import T from "../helpers/T.svelte"
    import Button from "../inputs/Button.svelte"

    const tabs: SettingsTabs[] = ["general", "display_settings", "styles", "groups", "actions", "connection", "cloud", "theme", "other"]
</script>

<div class="main">
    {#each tabs as tab}
        <Button id="button" on:click={() => settingsTab.set(tab)} active={$settingsTab === tab} bold={false}>
            <Icon id={tab} right />
            <p style="margin: 5px;"><T id="settings.{tab}" /></p>
        </Button>
    {/each}
</div>

<style>
    .main :global(#button) {
        padding: 0.3em 0.8em;
        width: 100%;
    }

    .main :global(button:nth-child(even)) {
        background-color: rgb(0 0 20 / 0.08);
    }
</style>
