<script lang="ts">
    import { settingsTab } from "../../stores"
    import T from "../helpers/T.svelte"
    import Connection from "./tabs/Connection.svelte"
    import Files from "./tabs/Files.svelte"
    import General from "./tabs/General.svelte"
    import Other from "./tabs/Other.svelte"
    import Outputs from "./tabs/Outputs.svelte"
    import Profiles from "./tabs/Profiles.svelte"
    import Styles from "./tabs/Styles.svelte"
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
        {:else if $settingsTab === "display_settings"}
            <Outputs />
        {:else if $settingsTab === "styles"}
            <Styles />
        {:else if $settingsTab === "connection"}
            <Connection />
        {:else if $settingsTab === "files"}
            <Files />
        {:else if $settingsTab === "profiles"}
            <Profiles />
        {:else if $settingsTab === "theme"}
            <Theme />
        {:else if $settingsTab === "other"}
            <Other />
        {/if}
    </div>
</main>

<style>
    main {
        display: flex;
        flex-direction: column;
        height: 100%;

        position: relative;
    }

    h2 {
        text-align: center;
        font-size: 1.8em;
        padding: 20px 0;
        color: var(--text);
    }

    .scroll {
        overflow-y: auto;
        /* overflow-x: hidden; */
        height: 100%;
        padding: 0 50px;
    }

    div:not(.scroll) {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin: 5px 0;
    }
</style>
