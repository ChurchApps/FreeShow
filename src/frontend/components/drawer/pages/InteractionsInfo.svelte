<script lang="ts">
    import { activeInteractions, interactions, openedInteractionId, shows } from "../../../stores"
    import Icon from "../../helpers/Icon.svelte"
    import Link from "../../inputs/Link.svelte"
    import { getInteraction } from "./interactions"
    import MaterialButton from "../../inputs/MaterialButton.svelte"
    import { generateSlide } from "./interactionSlides"
    import T from "../../helpers/T.svelte"
    import { onMount } from "svelte"

    $: openedId = $openedInteractionId
    $: openedInteraction = $interactions[openedId] || null
    // console.log(openedInteraction)

    $: isActive = $activeInteractions.includes(openedId)

    let interaction = getInteraction(openedId) || null
    $: if (isActive) interaction = getInteraction(openedId) || null
    else interaction = null

    $: url = interaction?.dbid ? `https://freeshow.net/interaction#id=${interaction.dbid}` : null
    $: controllerUrl = interaction?.dbid && interaction?.dbsecret ? `https://freeshow.net/interaction_controller#id=${interaction.dbsecret}` : null

    let showExists = false
    onMount(() => {
        const showId = `interaction-${openedId}`
        showExists = !!$shows[showId]
    })
</script>

<div class="padding">
    {#if openedId}
        {#if openedInteraction?.inputs?.length}
            {#if url}
                <div style="padding: 4px 2px;text-align: center;margin-bottom: 10px; max-width: 100%; display: flex; justify-content: center; align-items: center;">
                    <Link {url}>
                        <span style="text-overflow: ellipsis; overflow: hidden; white-space: nowrap;">{url.replace("https://", "")}</span>
                        <Icon id="launch" white />
                    </Link>
                </div>
            {/if}

            <!-- Generate slides -->
            {#if !isActive || !showExists}
                <MaterialButton variant="outlined" icon="slide" style="width: 100%;" on:click={() => generateSlide("join")} white><T id="interaction.generate_slide" />: Join</MaterialButton>
                <MaterialButton variant="outlined" icon="slide" style="width: 100%;" on:click={() => generateSlide("players")} white><T id="interaction.generate_slide" />: Players</MaterialButton>
                <MaterialButton variant="outlined" icon="slide" style="width: 100%;" on:click={() => generateSlide("question")} white><T id="interaction.generate_slide" />: Question</MaterialButton>
                <MaterialButton variant="outlined" icon="slide" style="width: 100%;" on:click={() => generateSlide("leaderboard")} white><T id="interaction.generate_slide" />: Leaderboard</MaterialButton>
            {/if}
        {/if}

        {#if controllerUrl}
            <div style="flex: 1;" />
            <div style="padding: 4px 2px;text-align: center;margin-top: 10px;max-width: 100%;display: flex;justify-content: center;align-items: center;font-size: 0.7em;opacity: 0.8;">
                <Link url={controllerUrl}>
                    <span style="text-overflow: ellipsis;overflow: hidden;white-space: nowrap;">{controllerUrl.replace("https://", "").replace(/id=[^&]+/g, "id=...")}</span>
                    <Icon id="launch" size={0.8} white />
                </Link>
            </div>
        {/if}
    {/if}
</div>

<style>
    .padding {
        padding: 10px;

        display: flex;
        flex-direction: column;
        align-items: center;
        flex: 1;
        box-sizing: border-box;
    }
</style>
