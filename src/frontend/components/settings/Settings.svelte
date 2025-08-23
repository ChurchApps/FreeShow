<script lang="ts">
    import { settingsTab } from "../../stores"
    import T from "../helpers/T.svelte"
    import Connection from "./tabs/Connection.svelte"
    import Files from "./tabs/Files.svelte"
    import FilesButtons from "./tabs/FilesButtons.svelte"
    import General from "./tabs/General.svelte"
    import Other from "./tabs/Other.svelte"
    import OtherButtons from "./tabs/OtherButtons.svelte"
    import Outputs from "./tabs/Outputs.svelte"
    import OutputsTabs from "./tabs/OutputsTabs.svelte"
    import Profiles from "./tabs/Profiles.svelte"
    import ProfilesTabs from "./tabs/ProfilesTabs.svelte"
    import Styles from "./tabs/Styles.svelte"
    import StylesTabs from "./tabs/StylesTabs.svelte"
    import Theme from "./tabs/Theme.svelte"
    import ThemeButtons from "./tabs/ThemeButtons.svelte"
    import ThemeTabs from "./tabs/ThemeTabs.svelte"

    $: tabId = $settingsTab

    let scrolled = false
    $: if (tabId === null) scrolled = false
    function scroll(e) {
        scrolled = e.target.scrollTop > 0
    }

    const hints = {
        display_settings: "settings.outputs_hint",
        styles: "settings.styles_hint",
        profiles: "profile.profiles_hint"
    }
</script>

<main>
    <div class="title" style={scrolled ? "box-shadow: 2px 2px 4px 5px rgb(0 0 0 / 0.1);" : ""}>
        <h2>
            {#key tabId}
                <T id="settings.{tabId}" />
            {/key}
        </h2>

        {#if hints[tabId]}
            <p class="hint"><T id={hints[tabId]} /></p>
        {/if}

        {#if tabId === "theme"}
            <div class="buttons">
                <ThemeButtons />
            </div>
        {/if}
    </div>

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

    <div class="tabs">
        {#if tabId === "display_settings"}
            <OutputsTabs />
        {:else if tabId === "styles"}
            <StylesTabs />
        {:else if tabId === "files"}
            <FilesButtons />
        {:else if tabId === "profiles"}
            <ProfilesTabs />
        {:else if tabId === "theme"}
            <ThemeTabs />
        {:else if tabId === "other"}
            <OtherButtons />
        {/if}
    </div>
</main>

<style>
    main {
        display: flex;
        flex-direction: column;
        height: 100%;

        position: relative;

        --padding: 150px;
    }

    .title {
        display: flex;
        align-items: center;
        justify-content: space-between;

        padding: 15px var(--padding);
        border-bottom: 1px solid var(--primary-lighter);

        transition: 0.2s box-shadow ease;
    }

    h2 {
        font-size: 1.6em;
        color: var(--text);

        overflow: visible;
        margin-right: 20px;
    }

    .hint {
        font-style: italic;
        font-size: 0.8em;
        opacity: 0.4;

        white-space: initial;

        text-align: right;
        max-width: 300px;
        /* align-self: flex-end; */
    }

    .buttons {
        display: flex;
        gap: 5px;
    }

    .scroll {
        position: relative;

        overflow-y: auto;
        /* overflow-x: hidden; */
        height: 100%;
        padding: 20px var(--padding);
    }

    .tabs {
        z-index: 1;
    }
</style>
