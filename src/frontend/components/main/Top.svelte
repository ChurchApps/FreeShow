<script type="ts">
    import { OUTPUT } from "../../../types/Channels"
    import { dictionary, os, outputDisplay, outputs, saved } from "../../stores"
    import { send } from "../../utils/request"
    import Icon from "../helpers/Icon.svelte"
    import { getActiveOutputs } from "../helpers/output"
    import Button from "../inputs/Button.svelte"
    import TopButton from "../inputs/TopButton.svelte"

    function display(e: any) {
        let enabledOutputs: any[] = getActiveOutputs($outputs, false)
        enabledOutputs.forEach((id) => {
            let output: any = { id, ...$outputs[id] }
            send(OUTPUT, ["DISPLAY"], { enabled: !$outputDisplay, output, force: e.ctrlKey || e.metaKey })
        })
    }
</script>

<div class="top">
    <span style="width: 300px;-webkit-app-region: no-drag;">
        {#if !$saved && $os.platform !== "win32"}
            <div class="unsaved" />
        {/if}
        <!-- logo -->
        <h1 style="align-self: center;width: 100%;padding: 0px 10px;text-align: center;">FreeShow</h1>
    </span>
    <span>
        <TopButton id="show" />
        <TopButton id="edit" />
        <TopButton id="calendar" />
        <TopButton id="draw" />
        <TopButton id="stage" />
    </span>
    <span style="width: 300px;justify-content: flex-end;">
        <TopButton id="settings" hideLabel />
        <Button
            title={$outputDisplay ? $dictionary.menu?._title_display_stop : $dictionary.menu?._title_display}
            on:click={display}
            class="context #output display {$outputDisplay ? 'on' : 'off'}"
            red={$outputDisplay}
        >
            {#if $outputDisplay}
                <Icon id="cancelDisplay" size={1.8} white />
            {:else}
                <Icon id="outputs" size={1.8} white />
            {/if}
        </Button>
    </span>
</div>

<style>
    .top {
        position: relative;
        display: flex;
        justify-content: space-between;
        z-index: 30;
        min-height: 50px;
        height: 50px;

        /* disabled because it's causing unexpected behaviour in Windows 11 */
        /* -webkit-app-region: drag; */
    }
    .top span {
        display: flex;
    }

    .top :global(button) {
        -webkit-app-region: no-drag;
    }

    div :global(button.display) {
        display: flex;
        justify-content: center;
        min-width: 60px;
    }

    .unsaved {
        position: absolute;
        left: 0;
        height: 100%;
        width: 5px;
        background-color: rgb(255 0 0 / 0.25);
    }
</style>
