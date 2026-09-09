<script lang="ts">
    import { onMount } from "svelte"
    import { Main } from "../../../../types/IPC/Main"
    import { formatBytes } from "../../../components/helpers/bytes"
    import T from "../../../components/helpers/T.svelte"
    import InputRow from "../../../components/input/InputRow.svelte"
    import MaterialButton from "../../../components/inputs/MaterialButton.svelte"
    import Center from "../../../components/system/Center.svelte"
    import { requestMain, sendMain } from "../../../IPC/main"

    let files: { path: string; name: string; size: number }[] = []
    onMount(async () => {
        const downloadedFiles = await requestMain(Main.AI_GET_BIN)
        if (downloadedFiles?.length) files = downloadedFiles
    })

    // let isDeleting = false
    // async function deleteModel(path: string) {
    //     isDeleting = true
    //     const isDeleted = await requestMain(Main.AI_DELETE_BIN, { path })
    //     if (isDeleted) files = files.filter((file) => file.path !== path)
    //     isDeleting = false
    // }

    function openInSystem(path: string) {
        sendMain(Main.SYSTEM_OPEN, path)
    }
</script>

{#if files.length}
    <div class="files">
        {#each files as file}
            <InputRow style="display: flex;align-items: center;background-color: var(--primary-darker);border-radius: 6px;border-bottom: 2px solid var(--primary-lighter);">
                <p style="display: flex;justify-content: space-between;padding: 0 14px;flex: 1;text-transform: capitalize;">
                    <span>{file.name}</span>
                    <span style="font-size: 0.9em;opacity: 0.6;">{formatBytes(file.size)}</span>
                </p>

                <MaterialButton variant="outlined" icon="launch" title="main.system_open" on:click={() => openInSystem(file.path)} white />
            </InputRow>
        {/each}
    </div>
{:else}
    <Center faded>
        <T id="empty.general" />
    </Center>
{/if}
