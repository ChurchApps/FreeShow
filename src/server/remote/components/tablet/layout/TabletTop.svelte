<script lang="ts">
    import { dictionary, activeTab } from "../../../util/stores"
    import { translate } from "../../../util/helpers"
    import Icon from "../../../../common/components/Icon.svelte"
    import Button from "../../../../common/components/Button.svelte"

    // "show" or "edit" mode
    // activeTab will now track this mode instead of "shows"/"scripture"/etc
</script>

<div class="top">
    <span class="logo-area">
        <h1 style="align-self: center;width: 100%;padding: 0px 10px;text-align: center;font-size: 1.8em;">FreeShow</h1>
    </span>
    <span class="middle-buttons">
        <!-- Show Mode -->
        <Button class="top-button {$activeTab === 'show' ? 'active' : ''}" on:click={() => activeTab.set("show")} title={translate("mode.show", $dictionary)}>
            <Icon id="play" size={1.6} white />
            <span class="label">{translate("mode.show", $dictionary)}</span>
        </Button>

        <!-- Edit Mode -->
        <Button class="top-button {$activeTab === 'edit' ? 'active' : ''}" on:click={() => activeTab.set("edit")} title={translate("mode.edit", $dictionary)}>
            <Icon id="edit" size={1.6} white />
            <span class="label">{translate("mode.edit", $dictionary)}</span>
        </Button>
    </span>
    <span class="right-buttons">
        <!-- Add other top buttons here if needed -->
    </span>
</div>

<style>
    .top {
        position: relative;
        display: flex;
        justify-content: space-between;
        z-index: 30;
        min-height: 40px;
        height: 40px;
        background-color: var(--primary);
        box-shadow: 0 2px 5px rgba(0, 0, 0, 0.2);
    }

    .top span {
        display: flex;
        align-items: center;
    }

    .logo-area {
        width: 300px; /* Match navigation width */
    }

    .middle-buttons {
        flex: 1;
        justify-content: center;
        gap: 10px;
    }

    .right-buttons {
        width: 300px;
        justify-content: flex-end;
    }

    /* Mimic TopButton styles */
    :global(.top-button) {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        height: 100%;
        padding: 0 15px;
        background: transparent;
        border: none;
        color: var(--text);
        opacity: 0.7;
        cursor: pointer;
        transition: opacity 0.2s;
        border-radius: 0 !important;
    }

    :global(.top-button:hover) {
        opacity: 1;
        background-color: rgba(255, 255, 255, 0.05);
    }

    :global(.top-button.active) {
        opacity: 1;
        border-bottom: 2px solid var(--secondary) !important;
    }

    .label {
        font-size: 0.7em;
        margin-top: 2px;
        display: none; /* Hide label on smaller screens if needed, or keep consistent */
    }

    @media (min-width: 1200px) {
        .label {
            display: block;
        }
    }
</style>
