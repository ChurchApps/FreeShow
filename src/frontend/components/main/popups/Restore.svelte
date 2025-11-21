<script lang="ts">
    import { onMount } from "svelte"
    import { requestMain, sendMain } from "../../../IPC/main"
    import { Main } from "../../../../types/IPC/Main"
    import { activePopup, popupData, showsCache } from "../../../stores"
    import MaterialButton from "../../inputs/MaterialButton.svelte"
    import Icon from "../../helpers/Icon.svelte"
    import T from "../../helpers/T.svelte"
    import { translateText } from "../../../utils/language"

    let backupsList: { name: string; date: number }[] = []
    onMount(async () => {
        backupsList = await requestMain(Main.BACKUPS)
        backupsList = backupsList.sort((a, b) => b.date - a.date)

        if (!backupsList.length) restoreCustom()
    })

    function restoreCustom() {
        showsCache.set({})
        sendMain(Main.RESTORE)
    }

    function getDaysAgo(date: number) {
        const diff = Date.now() - date
        const days = Math.floor(diff / (1000 * 60 * 60 * 24))

        if (days === 0) return translateText("calendar.today")
        return `${days}d`
    }
</script>

{#if $popupData.back}
    <MaterialButton class="popup-back" icon="back" iconSize={1.3} title="actions.back" on:click={() => activePopup.set($popupData.back)} />
{/if}

<div class="list">
    {#each backupsList as backup}
        <MaterialButton variant="outlined" title="settings.restore" on:click={() => requestMain(Main.RESTORE, { folder: backup.name })}>
            <div class="info">
                <div class="name">{backup.name.endsWith("_auto") ? translateText("settings.auto") : backup.name}</div>
                <div class="date">{getDaysAgo(backup.date)} - {new Date(backup.date).toLocaleString()}</div>
            </div>
        </MaterialButton>
    {/each}
</div>

<MaterialButton variant="outlined" on:click={restoreCustom}>
    <Icon id="import" size={1.3} />
    <!-- <p><T id="settings.restore" /></p> -->
    <!-- <p><T id="actions.choose_custom" /></p> -->
    <p><T id="inputs.change_folder" /></p>
</MaterialButton>

<style>
    .list {
        display: flex;
        flex-direction: column;
        gap: 5px;
        margin-bottom: 20px;
    }

    .info {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 4px;
        width: 100%;
    }

    .date {
        font-size: 0.9em;
        opacity: 0.7;
        font-family: monospace;
    }
</style>
