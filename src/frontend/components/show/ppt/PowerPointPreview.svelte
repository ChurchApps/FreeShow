<script lang="ts">
    import { onDestroy, onMount } from "svelte"
    import { MAIN } from "../../../../types/Channels"
    import { ShowRef } from "../../../../types/Projects"
    import { activeShow, os, outLocked, outputs, presentationApps, presentationData, special } from "../../../stores"
    import { send } from "../../../utils/request"
    import Icon from "../../helpers/Icon.svelte"
    import { getFileName, removeExtension } from "../../helpers/media"
    import { getActiveOutputs, getOutputContent, setOutput } from "../../helpers/output"
    import Button from "../../inputs/Button.svelte"
    import Dropdown from "../../inputs/Dropdown.svelte"
    import { clearBackground, clearSlide } from "../../output/clear"
    import Center from "../../system/Center.svelte"
    import ScreenCapture from "./ScreenCapture.svelte"
    import T from "../../helpers/T.svelte"

    export let show: ShowRef

    // WIP use savedScreen = $projects[$activeProject || ""].shows.find((a) => a.id === path)?.data?.screenName to determine if it is active or not

    onMount(() => {
        send(MAIN, ["SLIDESHOW_GET_APPS"])
    })

    let opening: boolean = false
    let retry: boolean = false
    function newPresentation() {
        if ($outLocked) return

        reset()
        opening = true

        send(MAIN, ["START_SLIDESHOW"], { path: show.id, program: $special.presentationApp || "PowerPoint" })
        clearSlide()

        setTimeout(() => (opening ? (retry = true) : ""), 8000)
    }

    $: outSlide = getOutputContent("", $outputs)

    $: if (opening && $presentationData?.id === show.id) start()
    function start() {
        let name = show.name || removeExtension(getFileName(show.id))
        setOutput("slide", { type: "ppt", id: show.id, name, page: $presentationData.stat?.position - 1, pages: $presentationData.stat?.slides })

        // update current out slide manually
        let outputId = getActiveOutputs($outputs, false, true, true)[0]
        outSlide = $outputs[outputId]?.out?.slide

        clearBackground()
        reset()
    }

    onDestroy(() => {
        if ($activeShow?.type !== "ppt") send(MAIN, ["PRESENTATION_CONTROL"], { action: "stop" })
    })

    $: if (show.id) reset()
    function reset() {
        opening = false
        retry = false
    }
</script>

{#if $presentationApps === null}
    <Center faded><T id="remote.loading" /></Center>
{:else if !$presentationApps.length}
    <Center>
        <T id="presentation_control.unsupported" />
        {$os || "this OS"}.
        <br />
        <T id="presentation_control.unsupported_tip" />
    </Center>
{:else if outSlide?.id === show.id}
    <div class="fill">
        <ScreenCapture path={show.id} />
    </div>

    {#if $presentationData?.id === show.id && $presentationData?.stat?.slides}
        <div class="info">
            <p style="white-space: normal;overflow: auto;padding: 3px 8px;">
                <b>{$presentationData.info?.titles[$presentationData.stat?.position - 1] || ""}</b>
                <span style="padding-left: 10px;">{$presentationData.info?.notes[$presentationData.stat?.position - 1] || ""}</span>
            </p>
        </div>
    {/if}
{:else if opening}
    <Center>
        <p><T id="presentation_control.opening" /></p>
        {#if retry}
            <br />
            <T id="presentation_control.retry" />
            <Button on:click={newPresentation} style="margin-top: 8px;"><T id="presentation_control.try_again" /></Button>
        {/if}
    </Center>
{:else}
    <div style="display: flex;flex-direction: column;height: 100%;">
        <Dropdown
            options={$presentationApps.map((id) => ({ name: id }))}
            value={$special.presentationApp || "PowerPoint"}
            on:click={(e) => {
                special.update((a) => {
                    a.presentationApp = e.detail?.name
                    return a
                })
            }}
        />

        <div class="fill">
            <Button on:click={newPresentation} style="font-size: 4em;width: 100%;" center>
                <Icon id="play" size={6} right />
                <T id="presentation_control.start" />
            </Button>
        </div>
    </div>
{/if}

<style>
    .fill {
        position: relative;
        height: 100%;

        display: flex;
        /* align-items: center; */
    }

    .info {
        width: 100%;
        max-height: 60%;
        background-color: var(--primary-darkest);

        display: flex;
        gap: 10px;
    }
</style>
