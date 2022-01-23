<script lang="ts">
  import type { SettingsTabs } from "../../../types/Tabs"
  import { settingsTab } from "../../stores"
  import Icon from "../helpers/Icon.svelte"
  import T from "../helpers/T.svelte"
  import Button from "../inputs/Button.svelte"

  const tabs: SettingsTabs[] = ["general", "theme", "groups", "display", "connection", "calendar", "other"]
</script>

<div class="main">
  {#each tabs as tab}
    <Button on:click={() => settingsTab.set(tab)} active={$settingsTab === tab} bold={false}>
      <Icon id={tab} />
      <T id="settings.{tab}" />
    </Button>
  {/each}
</div>

<style>
  .main :global(button) {
    padding: 20px;
    width: 100%;
  }
</style>
