<script lang="ts">
    import { onMount } from "svelte"
    import { Main } from "../../../../types/IPC/Main"
    import { requestMain, sendMain } from "../../../IPC/main"
    import { providerConnections } from "../../../stores"
    import T from "../../helpers/T.svelte"
    import MaterialButton from "../../inputs/MaterialButton.svelte"
    import Center from "../../system/Center.svelte"
    import ContentLibraryBrowser from "./ContentLibraryBrowser.svelte"
    import CLogo from "./CLogo.svelte"

    onMount(() => {
        if (!$providerConnections.canva) {
            requestMain(Main.PROVIDER_STARTUP_LOAD, { providerId: "canva", scope: "folder:read design:meta:read" })
        }
    })

    function handleConnect() {
        sendMain(Main.PROVIDER_LOAD_SERVICES, { providerId: "canva", cloudOnly: false })
    }
</script>

{#if $providerConnections.canva}
    <div style="width: 100%; height: 100%; display: flex; flex-direction: column;">
        <div style="flex: 1; overflow: hidden;">
            <ContentLibraryBrowser providerId="canva" columns={5} searchValue="" />
        </div>
    </div>
    <div style="position: absolute;bottom: 0;width: 100%;padding: 10px;display: flex;justify-content: center;">
        <p style="font-size: 0.8em;color: rgba(255 255 255 / 0.25);">Powered by Canva</p>
    </div>
{:else}
    <div class="gridgap">
        <Center style="flex-direction: column; gap: 1.5em;">
            <MaterialButton variant="outlined" on:click={handleConnect} style="width: 100%; max-width: 250px;">
                <CLogo />
                <T id="settings.connect_to" replace={["Canva"]} />
            </MaterialButton>

            <!-- <p style="font-size: 0.8em;color: rgba(255 255 255 / 0.2);">Powered by Canva</p> -->
        </Center>
    </div>
{/if}

<style>
    .gridgap {
        display: flex;
        flex-wrap: wrap;
        align-content: flex-start;
        padding: 5px;

        width: 100%;
        height: 100%;

        overflow-y: auto;
        overflow-x: hidden;
    }
</style>
