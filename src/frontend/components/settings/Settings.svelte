<script lang="ts">
  import { settingsTab } from "../../stores"
  import T from "../helpers/T.svelte"
  import Calendar from "./tabs/Calendar.svelte"
  import Connection from "./tabs/Connection.svelte"
  import Display from "./tabs/Display.svelte"
  import General from "./tabs/General.svelte"
  import Groups from "./tabs/Groups.svelte"
  import Output from "./tabs/Output.svelte"
  import Theme from "./tabs/Theme.svelte"
</script>

<main>
  <h2>
    {#key $settingsTab}
      <T id="settings.{$settingsTab}" />
    {/key}
  </h2>
  <div class="scroll">
    {#if $settingsTab === "general"}
      <General />
    {:else if $settingsTab === "theme"}
      <Theme />
    {:else if $settingsTab === "groups"}
      <Groups />
    {:else if $settingsTab === "output"}
      <Output />
    {:else if $settingsTab === "display"}
      <Display />
    {:else if $settingsTab === "connection"}
      <Connection />
    {:else if $settingsTab === "calendar"}
      <Calendar />
    {/if}
  </div>
</main>

<style>
  main {
    display: flex;
    flex-direction: column;
    height: 100%;
  }

  h2 {
    text-align: center;
    font-size: 1.8em;
    padding: 20px 0;
  }

  .scroll {
    overflow-y: auto;
    overflow-x: hidden;
    height: 100%;
    padding: 0 100px;
  }

  div:not(.scroll) {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin: 5px 0;
  }
</style>
