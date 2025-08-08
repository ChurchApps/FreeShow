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

    $: tabId = $settingsTab

    let scrolled = false
    $: if (tabId === null) scrolled = false
    function scroll(e) {
        scrolled = e.target.scrollTop > 0
    }
</script>

<main>
    <h2 style={scrolled ? "box-shadow: 2px 2px 4px 5px rgb(0 0 0 / 0.1);" : ""}>
        {#key tabId}
            <T id="settings.{tabId}" />
        {/key}
    </h2>
    <div class="scroll" on:scroll={scroll}>
        {#if tabId === "general"}
            <General />
        {:else if tabId === "display_settings"}
            <Outputs />
        {:else if tabId === "styles"}
            <Styles />
        {:else if tabId === "connection"}
            <Connection />
        {:else if tabId === "files"}
            <Files />
        {:else if tabId === "profiles"}
            <Profiles />
        {:else if tabId === "theme"}
            <Theme />
        {:else if tabId === "other"}
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

        --padding: 120px;
    }

    h2 {
        padding: 15px var(--padding);
        font-size: 1.6em;
        color: var(--text);

        transition: 0.2s box-shadow ease;

        border-bottom: 1px solid var(--primary-lighter);
    }

    .scroll {
        overflow-y: auto;
        /* overflow-x: hidden; */
        height: 100%;
        padding: 20px var(--padding);
    }

    div:not(.scroll) {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin: 5px 0;
    }
</style>
