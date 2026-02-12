<script lang="ts">
    import { onDestroy, onMount } from "svelte"
    import { Main } from "../../../../types/IPC/Main"
    import { ShowRef } from "../../../../types/Projects"
    import { requestMain, sendMain } from "../../../IPC/main"
    import { activeShow, os, outLocked, outputs, presentationApps, presentationData, special } from "../../../stores"
    import { translateText } from "../../../utils/language"
    import Icon from "../../helpers/Icon.svelte"
    import { getFileName, removeExtension } from "../../helpers/media"
    import { getActiveOutputs, getOutputContent, setOutput } from "../../helpers/output"
    import T from "../../helpers/T.svelte"
    import Button from "../../inputs/Button.svelte"
    import Dropdown from "../../inputs/Dropdown.svelte"
    import { clearBackground, clearSlide } from "../../output/clear"
    import Center from "../../system/Center.svelte"
    import ScreenCapture from "./ScreenCapture.svelte"

    export let show: ShowRef

    // WIP use savedScreen = $projects[$activeProject || ""].shows.find((a) => a.id === path)?.data?.screenName to determine if it is active or not

    onMount(() => {
        requestMain(Main.SLIDESHOW_GET_APPS, undefined, (a) => presentationApps.set(a))
    })

    let opening = false
    let retry = false
    function newPresentation() {
        if ($outLocked) return

        reset()
        opening = true

        sendMain(Main.START_SLIDESHOW, { path: show.id, program: $special.presentationApp || "PowerPoint" })
        clearSlide()

        setTimeout(() => (opening ? (retry = true) : ""), 8000)
    }

    function keydown(e: KeyboardEvent) {
        if ($outLocked || !$presentationApps?.length) return

        if (e.key === " ") {
            e.preventDefault()
            if (outSlide?.id === show.id) sendMain(Main.PRESENTATION_CONTROL, { action: "next" })
            else if (!opening) newPresentation()
        }
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
        if ($activeShow?.type !== "ppt") sendMain(Main.PRESENTATION_CONTROL, { action: "stop" })
    })

    $: if (show.id) reset()
    function reset() {
        opening = false
        retry = false
    }

    function restartPresentation() {
        presentationData.set({})
        newPresentation()
    }
</script>

<svelte:window on:keydown={keydown} />

{#if $presentationApps === null}
    <Center faded><T id="remote.loading" /></Center>
{:else if !$presentationApps.length}
    <Center>
        <T id="presentation_control.unsupported" />
        {$os.platform || "this OS"}.
        <br />
        <T id="presentation_control.unsupported_tip" />
    </Center>
{:else if outSlide?.id === show.id}
    <div class="fill">
        <ScreenCapture path={show.id} />
    </div>

    {#if $presentationData?.id === show.id && $presentationData?.stat?.slides}
        <div class="info">
            <Button on:click={restartPresentation} title={translateText("presentation_control.restart")}>
                <Icon id="refresh" />
            </Button>
            <p style="white-space: normal;overflow: auto;padding: 3px 8px;">
                <b>{$presentationData.info?.titles?.[$presentationData.stat?.position - 1] || ""}</b>
                <span style="padding-inline-start: 10px;">{$presentationData.info?.notes[$presentationData.stat?.position - 1] || ""}</span>
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
    }
</style>
