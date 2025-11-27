<script lang="ts">
    import { OUTPUT } from "../../../../types/Channels"
    import { drawerTabsData, photoApiCredits, playerVideos } from "../../../stores"
    import { send } from "../../../utils/request"
    import Icon from "../../helpers/Icon.svelte"
    import { getAllNormalOutputs } from "../../helpers/output"
    import T from "../../helpers/T.svelte"
    import Button from "../../inputs/Button.svelte"
    import Link from "../../inputs/Link.svelte"
    import InfoMetadata from "./InfoMetadata.svelte"

    $: active = $drawerTabsData.media?.openedSubSubTab?.online || "youtube"

    $: info = [
        { label: "info.likes", value: $photoApiCredits.likes },
        { label: "info.artist", value: $photoApiCredits.artist },
        { label: "info.artistUrl", value: $photoApiCredits.artistUrl, type: "url" },
        { label: "info.photoUrl", value: $photoApiCredits.photoUrl, type: "url" }
        // { label: "info.download", value: $photoApiCredits.downloadUrl, type: "url" },
    ]

    $: isPlayingYoutube = getAllNormalOutputs().find(output => {
        const bg = output.out?.background
        return bg?.type === "player" && $playerVideos[bg?.id || ""]?.type === "youtube"
    })
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
{:else if active === $photoApiCredits.type}
    {#if $photoApiCredits.photo}
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
