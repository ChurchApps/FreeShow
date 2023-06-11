<script lang="ts">
    import { settingsTab } from "../../stores"
    import T from "../helpers/T.svelte"
    import Actions from "./tabs/Actions.svelte"
    import Calendar from "./tabs/Calendar.svelte"
    import Cloud from "./tabs/Cloud.svelte"
    import Connection from "./tabs/Connection.svelte"
    import General from "./tabs/General.svelte"
    import Groups from "./tabs/Groups.svelte"
    import Other from "./tabs/Other.svelte"
    import Outputs from "./tabs/Outputs.svelte"
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
        {:else if $settingsTab === "theme"}
            <Theme />
        {:else if $settingsTab === "groups"}
            <Groups />
        {:else if $settingsTab === "styles"}
            <Styles />
        {:else if $settingsTab === "outputs"}
            <Outputs />
        {:else if $settingsTab === "actions"}
            <Actions />
        {:else if $settingsTab === "connection"}
            <Connection />
        {:else if $settingsTab === "cloud"}
            <Cloud />
        {:else if $settingsTab === "calendar"}
            <Calendar />
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
