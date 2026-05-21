<script lang="ts">
    import { onMount } from "svelte"
    import { Main } from "../../../../types/IPC/Main"
    import { sendMain } from "../../../IPC/main"
    import { alertUpdates, special, version } from "../../../stores"
    import { getUpdateData } from "../../../utils/checkForUpdates"
    import Loader from "../Loader.svelte"
    import T from "../../helpers/T.svelte"
    import MaterialButton from "../../inputs/MaterialButton.svelte"
    import MaterialToggleSwitch from "../../inputs/MaterialToggleSwitch.svelte"
    import InputRow from "../../input/InputRow.svelte"

    let loading = true
    let hasError = false
    let latestVersion = ""
    let changelog = ""
    let hasUpdate = false

    function updateSpecial(value: any, key: string) {
        special.update((a) => {
            if (!value) delete a[key]
            else a[key] = value

            return a
        })
    }

    async function checkUpdates() {
        loading = true
        hasError = false
        latestVersion = ""
        changelog = ""
        hasUpdate = false

        try {
            const currentVersion = $version
            const includeBeta = currentVersion.includes("-beta") || $special.betaVersionAlert
            const updateData = await getUpdateData(currentVersion, includeBeta)

            latestVersion = updateData.latestVersion
            changelog = (updateData.changelog || "").replaceAll("\r\n", "<br>").replaceAll("-", "•")
            hasUpdate = updateData.hasUpdate
        } catch (error) {
            console.warn(error)
            hasError = true
        }

        loading = false
    }

    function downloadLatest() {
        if (!hasUpdate || !latestVersion) return

        const isBeta = latestVersion.includes("-beta")
        sendMain(Main.URL, isBeta ? "https://github.com/ChurchApps/FreeShow/releases" : "https://freeshow.app/?download")
    }

    onMount(checkUpdates)

    $: isBeta = $version.includes("-beta")
    $: versionsMatch = !!latestVersion && $version === latestVersion
</script>

<div class="settings">
    <InputRow arrow={$alertUpdates}>
        <MaterialToggleSwitch style="flex: 1;" label="settings.alert_updates" checked={$alertUpdates} defaultValue={true} on:change={(e) => alertUpdates.set(e.detail)} />
        <div slot="menu">
            <MaterialToggleSwitch label="settings.alert_updates_beta" disabled={isBeta} checked={isBeta ? $alertUpdates : $special.betaVersionAlert} defaultValue={false} on:change={(e) => updateSpecial(e.detail, "betaVersionAlert")} />
        </div>
    </InputRow>

    <MaterialToggleSwitch label="settings.auto_updates" checked={$special.autoUpdates} on:change={(e) => updateSpecial(e.detail, "autoUpdates")} />
</div>

{#if !loading && !versionsMatch && latestVersion}
    <div class="versions">
        <span class="value">v{$version}</span>
        <span class="label" style="color: var(--secondary);font-weight: bold;">→</span>
        <span class="value">v{latestVersion}</span>
    </div>
{/if}

{#if hasUpdate}
    <MaterialButton variant="contained" style="margin-top: 10px;" icon="download" on:click={downloadLatest}>
        <T id="about.download_latest" />
    </MaterialButton>
{:else if !loading && !hasError}
    <div class="versions">
        <span class="label" style="color: var(--secondary);font-weight: bold;">✓</span>
        <span class="value">v{latestVersion}</span>
    </div>
{/if}

{#if loading}
    <div class="loading">
        <Loader />
    </div>
{:else if hasError || hasUpdate}
    <div class="changelog">
        <h3><T id="about.changes" /></h3>

        {#if hasError}
            <p>Error: Could not check for updates right now.</p>
        {:else if changelog}
            <div class="changelog-content">{@html changelog}</div>
        {/if}
    </div>
{/if}

<style>
    .settings {
        display: flex;
        flex-direction: column;
        margin-bottom: 10px;
    }

    .versions {
        display: flex;
        justify-content: center;
        gap: 5px;
        margin-top: 5px;
    }

    .value {
        color: var(--text);
        font-weight: 600;
    }

    .loading {
        margin-top: 15px;
        display: flex;
        justify-content: center;
    }

    .changelog {
        margin-top: 15px;
        padding: 16px;
        background-color: var(--primary-darker);
        border-radius: 8px;
        max-height: 300px;
        overflow-y: auto;
    }

    h3 {
        color: var(--text);
        text-decoration: underline solid var(--secondary);
        margin-bottom: 8px;
    }

    .changelog-content {
        line-height: 1.4;
    }
</style>
