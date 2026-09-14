<script lang="ts">
    import { OUTPUT } from "../../../../types/Channels"
    import type { Output } from "../../../../types/Output"
    import { activePopup, currentOutputSettings, outputs, special } from "../../../stores"
    import { send } from "../../../utils/request"
    import HRule from "../../input/HRule.svelte"
    import InputRow from "../../input/InputRow.svelte"
    import MaterialButton from "../../inputs/MaterialButton.svelte"
    import MaterialDropdown from "../../inputs/MaterialDropdown.svelte"
    import MaterialNumberInput from "../../inputs/MaterialNumberInput.svelte"
    import Tip from "../Tip.svelte"

    let currentOutput: (Output & { id: string }) | null = null
    $: if ($currentOutputSettings) getCurrentOutput($currentOutputSettings)
    function getCurrentOutput(id: string) {
        currentOutput = { id, ...$outputs[id] }
    }

    function updateOutput(key: string, value: any) {
        if (!currentOutput) return

        outputs.update((a) => {
            if (key.includes(".")) {
                let split = key.split(".")
                if (!a[currentOutput!.id][split[0]]) a[currentOutput!.id][split[0]] = {}
                a[currentOutput!.id][split[0]][split[1]] = value
                if (split[1] === "lines" && !Number(value)) delete a[currentOutput!.id][split[0]][split[1]]
            } else {
                a[currentOutput!.id][key] = value
            }

            return a
        })

        getCurrentOutput(currentOutput.id)
    }

    function updateBounds(type: string | object, value?: number) {
        const bounds = typeof type === "object" ? type : { [type]: value }
        updateOutput("bounds", { ...currentOutput?.bounds, ...bounds })
        updateOutput("screen", null)
        setTimeout(() => send(OUTPUT, ["UPDATE_BOUNDS"], currentOutput), 10)
    }

    // Resolutions

    const commonResolutions = [
        { value: "3840x2160", label: "4K", data: "3840 x 2160" },
        { value: "2560x1440", label: "1440p", data: "2560 x 1440" },
        { value: "1920x1080", label: "1080p", data: "1920 x 1080" },
        { value: "1280x720", label: "720p", data: "1280 x 720" },
        // { value: "1024x576", label: "576p", data: "1024 x 576" },
        { value: "854x480", label: "480p", data: "854 x 480" },
        { value: "640x360", label: "360p", data: "640 x 360" }
        // { value: "426x240", label: "240p", data: "426 x 240" }
    ]
    $: currentResolution = currentOutput?.forcedResolution ? `${currentOutput.forcedResolution?.width}x${currentOutput.forcedResolution?.height}` : `${currentOutput?.bounds?.width}x${currentOutput?.bounds?.height}`
    function setCommonResolution(resolution: string) {
        if (!currentOutput) return

        const previousResolution = `${currentOutput.bounds?.width}x${currentOutput.bounds?.height}`

        const [width, height] = resolution.split("x").map(Number)
        updateBounds({ width, height })

        // auto set bitrate
        setCommonBitrate(previousResolution, resolution)
    }

    const commonBitrates = {
        "3840x2160": 13000, // 4K (13 Mbps - 30 Mpbs)
        "2560x1440": 6000, // 1440p (6 Mbps - 13 Mbps)
        "1920x1080": 4000, // 1080p (3000 Kbps - 6000 Kbps)
        "1280x720": 2500, // 720p (1500 Kbps - 4000 Kbps)
        "854x480": 1000, // 480p (500 Kbps - 2000 Kbps)
        "640x360": 800 // 360p (400 Kbps - 1000 Kbps)
    }
    function setCommonBitrate(previousResolution: string, newResolution: string) {
        if (!currentOutput) return

        const bitrate = commonBitrates[newResolution]
        const dataKey = currentOutput?.rtmp ? "rtmpData" : currentOutput?.webrtc ? "webrtcData" : null
        if (!bitrate || !dataKey) return

        const currentBitrate = Number(currentOutput[dataKey]?.bitrate || 0)
        const previousBitrate = commonBitrates[previousResolution]
        const isCustom = !!currentBitrate && currentBitrate !== previousBitrate
        if (isCustom) return

        updateOutput(`${dataKey}.bitrate`, bitrate)
    }

    let moreOptions = false
</script>

{#if !currentOutput?.invisible}
    <MaterialButton class="popup-back" icon="back" iconSize={1.3} title="actions.back" on:click={() => activePopup.set("choose_screen")} />
{/if}

<div style="min-width: 650px;">
    {#if !currentOutput?.invisible}
        {#if !$special.hideCursor}
            <Tip value="settings.manual_drag_hint" />
        {/if}
    {/if}
</div>

{#if !currentOutput?.invisible}
    <HRule title="settings.position" />

    <InputRow>
        <MaterialNumberInput label="edit.x (px)" value={currentOutput?.bounds?.x || 0} min={-10000} on:change={(e) => updateBounds("x", e.detail)} />
        <MaterialNumberInput label="edit.y (px)" value={currentOutput?.bounds?.y || 0} min={-10000} on:change={(e) => updateBounds("y", e.detail)} />
    </InputRow>

    <HRule title="edit.size" />

    <InputRow>
        <MaterialNumberInput label="edit.width (px)" disabled={!!currentOutput?.forcedResolution} value={currentOutput?.bounds?.width || 0} min={40} on:change={(e) => updateBounds("width", e.detail)} />
        <MaterialNumberInput label="edit.height (px)" disabled={!!currentOutput?.forcedResolution} value={currentOutput?.bounds?.height || 0} min={40} on:change={(e) => updateBounds("height", e.detail)} />
    </InputRow>
{:else}
    <MaterialButton class="popup-options {moreOptions ? 'active' : ''}" icon="options" iconSize={1.3} title={moreOptions ? "actions.close" : "create_show.more_options"} on:click={() => (moreOptions = !moreOptions)} white />

    <MaterialDropdown label="settings.resolution" value={currentResolution} options={commonResolutions} disabled={!!currentOutput?.forcedResolution} on:change={(e) => setCommonResolution(e.detail)} />

    {#if moreOptions}
        <HRule title="edit.size" />
        <InputRow>
            <MaterialNumberInput label="edit.width (px)" disabled={!!currentOutput?.forcedResolution} value={currentOutput?.bounds?.width || 0} min={40} on:change={(e) => updateBounds("width", e.detail)} />
            <MaterialNumberInput label="edit.height (px)" disabled={!!currentOutput?.forcedResolution} value={currentOutput?.bounds?.height || 0} min={40} on:change={(e) => updateBounds("height", e.detail)} />
        </InputRow>
    {/if}
{/if}

<!-- {#if !currentOutput?.invisible}
    <Button on:click={() => toggleOutputs(null, { force: true })} style="width: 100%;margin-top: 10px;" dark center>
        <Icon id="outputs" right />
        <p><T id="context.force_outputs" /></p>
    </Button>
{/if} -->
