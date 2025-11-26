<script lang="ts">
    import { onMount } from "svelte"
    import { requestMain, sendMain } from "../../../IPC/main"
    import { Main } from "../../../../types/IPC/Main"
    import { activePopup, popupData, showsCache } from "../../../stores"
    import MaterialButton from "../../inputs/MaterialButton.svelte"
    import Icon from "../../helpers/Icon.svelte"
    import T from "../../helpers/T.svelte"
    import { translateText } from "../../../utils/language"
    import InputRow from "../../input/InputRow.svelte"

    let backupsList: { path: string; name: string; date: number; size: number }[] = []
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

    function sizeToString(size: number) {
        if (size < 1024) return `${size} B`
        if (size < 1024 * 1024) return `${(size / 1024).toFixed(2)} KB`
        if (size < 1024 * 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(2)} MB`
        return `${(size / (1024 * 1024 * 1024)).toFixed(2)} GB`
    }

    let deletingPath: string | null = null
    let undoTimeout: NodeJS.Timeout | null = null
    function deleteBackup(path: string) {
        if (undoTimeout) {
            if (deletingPath === path) {
                clearTimeout(undoTimeout)
                clear()
            }
            return
        }

        deletingPath = path
        undoTimeout = setTimeout(() => {
            sendMain(Main.DELETE_BACKUP, { path })
            backupsList = backupsList.filter((b) => b.path !== path)
            clear()
        }, 5000)

        function clear() {
            deletingPath = null
            undoTimeout = null
        }
    }
</script>

{#if $popupData.back}
    <MaterialButton class="popup-back" icon="back" iconSize={1.3} title="actions.back" on:click={() => activePopup.set($popupData.back)} />
{/if}

<div class="list">
    {#each backupsList as backup}
        <InputRow>
            <MaterialButton variant="outlined" title="settings.restore" style="width: 100%;" on:click={() => requestMain(Main.RESTORE, { folder: backup.name })}>
                <div class="info">
                    <div class="name">{backup.name.endsWith("_auto") ? translateText("settings.auto") : backup.name} <span style="opacity: 0.3;font-size: 0.7em;padding: 0 8px;">{sizeToString(backup.size)}</span></div>
                    <div class="date">{getDaysAgo(backup.date)} - {new Date(backup.date).toLocaleString()}</div>
                </div>
            </MaterialButton>

            <!-- show delete button if backup is older than 30 days -->
            {#if backup.date < Date.now() - 86400000 * 30}
                <MaterialButton variant="outlined" icon={deletingPath === backup.path ? "undo" : "delete"} title="actions.delete" disabled={deletingPath !== backup.path && undoTimeout !== null} on:click={() => deleteBackup(backup.path)} />
            {/if}
        </InputRow>
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
