<script lang="ts">
    import { OUTPUT } from "../../../../types/Channels"
    import { activeDrawerOnlineTab, photoApiCredits } from "../../../stores"
    import { send } from "../../../utils/request"
    import Icon from "../../helpers/Icon.svelte"
    import T from "../../helpers/T.svelte"
    import Button from "../../inputs/Button.svelte"
    import Link from "../../inputs/Link.svelte"

    $: active = $activeDrawerOnlineTab

    // remove part after ? in URL
    function removeExtra(link: string) {
        link = link.replace("https://", "")
        let extra = link.indexOf("?")
        if (extra > -1) link = link.slice(0, extra)
        if (link.endsWith("/")) link = link.slice(0, link.length - 1)
        return link
    }
</script>

{#if active === "youtube"}
    <div class="scroll">
        <T id="error.video_unavailable" />
    </div>

    <Button on:click={() => send(OUTPUT, ["CLOSE_AD"])} center dark>
        <Icon id="close" right />
        <T id="inputs.close_ad" />
    </Button>
{:else if active === $photoApiCredits.type}
    {#if $photoApiCredits.photo}
        <main style="overflow-y: auto;">
            <h2 style="text-align: center;padding: 0 5px;" title={$photoApiCredits.photo}>
                {$photoApiCredits.photo}
            </h2>
            <p>
                <span class="title"><T id={"info.likes"} /></span>
                <span>{$photoApiCredits.likes}</span>
            </p>
            <p>
                <span class="title"><T id={"info.artist"} /></span>
                <span>{$photoApiCredits.artist}</span>
            </p>
            <p>
                <span class="title"><T id={"info.artistUrl"} /></span>
                <span><Link url={$photoApiCredits.artistUrl}>{removeExtra($photoApiCredits.artistUrl)}</Link></span>
            </p>
            <p>
                <span class="title"><T id={"info.photoUrl"} /></span>
                <span><Link url={$photoApiCredits.photoUrl}>{removeExtra($photoApiCredits.photoUrl)}</Link></span>
            </p>
            <!-- <p>
                <span class="title"><T id={"info.download"} /></span>
                <span>{$photoApiCredits.downloadUrl}</span>
            </p> -->
        </main>

        <div class="credits">
            Photo by <Link url={$photoApiCredits.artistUrl}>{$photoApiCredits.artist}</Link> on <span style="text-transform: capitalize;"><Link url={$photoApiCredits.homepage || $photoApiCredits.photoUrl}>{$photoApiCredits.type}</Link></span>
        </div>
    {/if}
{/if}

<style>
    main {
        overflow-y: auto;
    }

    main p {
        display: flex;
        justify-content: space-between;
        padding: 2px 10px;
        gap: 5px;
    }
    main p:nth-child(even) {
        background-color: rgb(0 0 20 / 0.15);
    }

    main p span:not(.title) {
        opacity: 0.8;

        overflow: hidden;
        direction: rtl;
    }

    .scroll {
        display: flex;
        flex-direction: column;
        flex: 1;
        overflow-y: auto;
        overflow-x: hidden;

        padding: 10px;
    }

    /* hr {
    border: none;
    height: 2px;
    margin: 20px 0;
    background-color: var(--primary-lighter);
  } */

    .credits {
        position: absolute;
        bottom: 10px;
        width: 100%;
        text-align: center;
    }
</style>
