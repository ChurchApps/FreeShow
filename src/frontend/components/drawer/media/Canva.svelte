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
    import MaterialTextInput from "../../inputs/MaterialTextInput.svelte"
    import Link from "../../inputs/Link.svelte"
    import Icon from "../../helpers/Icon.svelte"

    onMount(() => {
        if (!$providerConnections.canva) {
            requestMain(Main.PROVIDER_STARTUP_LOAD, { providerId: "canva", scope: "folder:read design:content:read design:meta:read" })
        }
    })

    function handleConnect() {
        sendMain(Main.PROVIDER_LOAD_SERVICES, { providerId: "canva", data: { canvaClientId, canvaClientSecret } })
    }

    let canvaClientId = ""
    let canvaClientSecret = ""
</script>

{#if $providerConnections.canva}
    <div style="width: 100%; height: 100%; display: flex; flex-direction: column;">
        <div style="flex: 1; overflow: hidden;">
            <ContentLibraryBrowser providerId="canva" columns={5} searchValue="" />
        </div>
    </div>
    <!-- <div style="position: absolute;bottom: 0;width: 100%;padding: 10px;display: flex;justify-content: center;">
        <p style="font-size: 0.8em;color: rgba(255 255 255 / 0.25);">Powered by Canva</p>
    </div> -->
{:else}
    <div class="gridgap">
        <Center style="flex-direction: column;">
            <Link url="https://freeshow.app/docs/media#connecting-to-canva">
                <T id="main.docs" />
                <Icon id="launch" white />
            </Link>

            <MaterialTextInput label="Client ID" value={canvaClientId} on:change={(e) => (canvaClientId = e.detail)} style="margin-top: 20px;width: 100%;max-width: 250px;" pasteBtn />
            <MaterialTextInput label="Client secret" value={canvaClientSecret} disabled={!canvaClientId} type="password" on:change={(e) => (canvaClientSecret = e.detail)} style="width: 100%;max-width: 250px;" pasteBtn />

            <MaterialButton variant="outlined" disabled={!canvaClientId || !canvaClientSecret} on:click={handleConnect} style="margin-top: 10px;width: 100%;max-width: 250px;">
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
