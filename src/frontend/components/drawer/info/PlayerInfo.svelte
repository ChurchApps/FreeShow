<script lang="ts">
    import { OUTPUT } from "../../../../types/Channels"
    import { Main } from "../../../../types/IPC/Main"
    import { requestMain } from "../../../IPC/main"
    import { drawerTabsData, photoApiCredits, playerVideos, providerConnections } from "../../../stores"
    import { send } from "../../../utils/request"
    import Icon from "../../helpers/Icon.svelte"
    import { getAllNormalOutputs } from "../../helpers/output"
    import T from "../../helpers/T.svelte"
    import Button from "../../inputs/Button.svelte"
    import Link from "../../inputs/Link.svelte"
    import MaterialButton from "../../inputs/MaterialButton.svelte"
    import CanvaInfo from "./CanvaInfo.svelte"
    import InfoMetadata from "./InfoMetadata.svelte"

    export let optionsOpen: boolean

    $: active = $drawerTabsData.media?.openedSubSubTab?.online || "youtube"

    $: info = [
        { label: "info.likes", value: $photoApiCredits.likes },
        { label: "info.artist", value: $photoApiCredits.artist },
        { label: "info.artistUrl", value: $photoApiCredits.artistUrl, type: "url" },
        { label: "info.photoUrl", value: $photoApiCredits.photoUrl, type: "url" }
        // { label: "info.download", value: $photoApiCredits.downloadUrl, type: "url" },
    ]

    $: isPlayingYoutube = getAllNormalOutputs().find((output) => {
        const bg = output.out?.background
        return bg?.type === "player" && $playerVideos[bg?.id || ""]?.type === "youtube"
    })

    function canvaDisconnect() {
        requestMain(Main.PROVIDER_DISCONNECT, { providerId: "canva" }, (result) => {
            if (result?.success) {
                providerConnections.update((c) => {
                    c.canva = false
                    return c
                })
            }
        })
    }
</script>

{#if active === "youtube"}
    {#if isPlayingYoutube}
        <div class="scroll">
            <T id="error.video_unavailable" />
        </div>

        <Button on:click={() => send(OUTPUT, ["CLOSE_AD"])} center dark>
            <Icon id="close" right />
            <T id="inputs.close_ad" />
        </Button>
    {/if}
{:else if active === "canva"}
    {#if optionsOpen}
        <div class="scroll">
            {#if $providerConnections.canva}
                <MaterialButton variant="outlined" icon="logout" on:click={canvaDisconnect}>
                    <T id="settings.disconnect_from" replace={["Canva"]} />
                </MaterialButton>
            {/if}
        </div>
    {:else}
        <CanvaInfo />
    {/if}
{:else if active === $photoApiCredits.type}
    {#if $photoApiCredits.photo !== undefined}
        <div style="flex: 1;margin-bottom: 25px;">
            <InfoMetadata title={$photoApiCredits.photo} {info} />
        </div>

        <div class="credits">
            Photo by <Link url={$photoApiCredits.artistUrl}>{$photoApiCredits.artist}</Link> on <span style="text-transform: capitalize;"><Link url={$photoApiCredits.homepage || $photoApiCredits.photoUrl}>{$photoApiCredits.type}</Link></span>
        </div>
    {/if}
{/if}

<style>
    .scroll {
        display: flex;
        flex-direction: column;
        flex: 1;
        overflow-y: auto;
        overflow-x: hidden;

        padding: 10px;
    }

    .credits {
        position: absolute;
        bottom: 10px;
        width: 100%;
        text-align: center;

        opacity: 0.7;
    }
</style>
