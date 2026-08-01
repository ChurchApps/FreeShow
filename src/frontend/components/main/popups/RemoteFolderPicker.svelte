<script lang="ts">
    // Browse the SERVER's folders and add one as a media/audio library folder.
    // Used on remote clients (web / hybrid desktop) where the native OS folder dialog
    // isn't available. Lists folders via the remote READ_FOLDER handler (mediaGateway
    // serves the files themselves).
    import { Main } from "../../../../types/IPC/Main"
    import { requestMain } from "../../../IPC/main"
    import { activePopup, popupData } from "../../../stores"
    import { addDrawerFolder } from "../../helpers/dropActions"
    import Icon from "../../helpers/Icon.svelte"
    import T from "../../helpers/T.svelte"
    import MaterialButton from "../../inputs/MaterialButton.svelte"

    const type: "media" | "audio" = $popupData?.type === "audio" ? "audio" : "media"

    let currentPath = ""
    let subfolders: { path: string; name: string }[] = []
    let files: string[] = []
    let loading = true

    const parentOf = (p: string) => {
        const i = Math.max(p.lastIndexOf("/"), p.lastIndexOf("\\"))
        return i < 0 ? "" : p.slice(0, i)
    }

    async function load(path: string) {
        loading = true
        const map = ((await requestMain(Main.READ_FOLDER, { path, depth: 0 })) || {}) as Record<string, any>
        const folders = Object.values(map).filter((e: any) => e?.isFolder)

        // when path is "" the server resolves its data root; the container is the shortest folder path
        const container = path || folders.reduce((min: any, e: any) => (!min || e.path.length < min.path.length ? e : min), null as any)?.path || ""
        currentPath = container

        subfolders = folders
            .filter((e: any) => e.path !== container && parentOf(e.path) === container)
            .map((e: any) => ({ path: e.path, name: e.name }))
            .sort((a, b) => a.name.localeCompare(b.name))

        // files directly inside this folder (so uploads are visible)
        files = Object.values(map)
            .filter((e: any) => !e?.isFolder && parentOf(e.path) === container)
            .map((e: any) => e.name)
            .sort((a: string, b: string) => a.localeCompare(b))

        loading = false
    }
    load("")

    function goUp() {
        const parent = parentOf(currentPath)
        if (parent) load(parent)
    }

    let newFolderName = ""
    let creating = false
    async function createNewFolder() {
        const name = newFolderName.trim()
        if (!name || creating) return
        creating = true
        const created = await requestMain(Main.CREATE_FOLDER, { path: currentPath, name })
        creating = false
        if (!created) return
        newFolderName = ""
        await load(currentPath) // refresh to show the new folder
    }

    function useFolder() {
        if (!currentPath) return
        addDrawerFolder({ path: currentPath }, type)
        activePopup.set(null)
    }

</script>

<div class="picker">
    <div class="path">
        <MaterialButton title="Up" on:click={goUp} disabled={loading || !parentOf(currentPath)}>
            <Icon id="back" white />
        </MaterialButton>
        <span title={currentPath}>{currentPath || "…"}</span>
    </div>

    <div class="list">
        {#if loading}
            <div class="empty">…</div>
        {:else if !subfolders.length && !files.length}
            <div class="empty"><T id="empty.general" /></div>
        {:else}
            {#each subfolders as folder}
                <button class="folder" on:click={() => load(folder.path)}>
                    <Icon id="folder" white />
                    <span>{folder.name}</span>
                </button>
            {/each}
            {#each files as file}
                <div class="folder file">
                    <Icon id="image" white />
                    <span>{file}</span>
                </div>
            {/each}
        {/if}
    </div>

    <div class="create">
        <!-- class "edit" tells the global shortcut handler to ignore keys here (otherwise Backspace deletes the selection) -->
        <input class="name edit" placeholder={"New folder name…"} bind:value={newFolderName} on:keydown={(e) => e.key === "Enter" && createNewFolder()} />
        <MaterialButton title="new.folder" disabled={loading || creating || !newFolderName.trim()} on:click={createNewFolder}>
            <Icon id="add" white />
        </MaterialButton>
    </div>

    <MaterialButton style="width: 100%;" variant="contained" disabled={loading} on:click={useFolder}>
        <Icon id="add" white />
        Select this folder
    </MaterialButton>
</div>

<style>
    .picker {
        display: flex;
        flex-direction: column;
        gap: 10px;
        width: 500px;
        max-width: 80vw;
    }
    .path {
        display: flex;
        align-items: center;
        gap: 8px;
        opacity: 0.8;
        font-size: 0.9em;
    }
    .path span {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        direction: rtl;
    }
    .list {
        display: flex;
        flex-direction: column;
        max-height: 45vh;
        overflow: auto;
        border: 1px solid var(--primary-lighter);
        border-radius: 4px;
        min-height: 120px;
    }
    .folder {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 10px 12px;
        background: transparent;
        border: none;
        color: var(--text);
        cursor: pointer;
        text-align: start;
    }
    .folder:hover {
        background-color: var(--hover);
    }
    .folder.file {
        opacity: 0.6;
        cursor: default;
    }
    .folder.file:hover {
        background-color: transparent;
    }
    .empty {
        padding: 20px;
        text-align: center;
        opacity: 0.5;
    }
    .create {
        display: flex;
        gap: 8px;
        align-items: stretch;
    }
    .create .name {
        flex: 1;
        padding: 8px 10px;
        color: var(--text);
        background-color: var(--primary-darkest);
        border: 1px solid var(--primary-lighter);
        border-radius: 4px;
        outline: none;
    }
    .create .name:focus {
        border-color: var(--secondary);
    }
</style>
