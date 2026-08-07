<script lang="ts">
    import Icon from "../../helpers/Icon.svelte"
    import MaterialButton from "../../inputs/MaterialButton.svelte"
    import MaterialToggleSwitch from "../../inputs/MaterialToggleSwitch.svelte"
    import AudioMeter from "../../drawer/audio/AudioMeter.svelte"
    import { activePopup, popupData } from "../../../stores"
    import { translateText } from "../../../utils/language"

    export let id: string
    export let name: string
    export let type: string
    export let icon: string | null = null
    export let color: string | undefined = undefined
    export let autoColor: string | undefined = undefined
    export let nodeType: "input" | "channel" | "merger" | "output"

    export let isSubNode: boolean = false
    export let isExpanded: boolean = false
    export let hasSubNodes: boolean = false
    export let channels: number = 0
    export let isEnabled: boolean = true
    export let isMuted: boolean = false
    export let hasInputConnection: boolean = true

    export let onToggleEnabled: ((enabled: boolean) => void) | undefined = undefined

    export let hoverTargetId: string | null = null
    export let isConnecting: boolean = false
    export let dragStartId: string | null = null
    export let dragStartType: string | null = null
    export let dragStartPortType: "in" | "out" | null = null

    export let onToggleExpand: () => void = () => {}
    export let onMouseDown: (e: MouseEvent, portType: "in" | "out", chIdx?: number) => void
    export let onMouseEnter: (e: MouseEvent) => void
    export let onMouseLeave: () => void
    export let onMouseEnterPort: (e: MouseEvent, chIdx: number) => void = () => {}
    export let onMouseLeavePort: () => void = () => {}
    export let onHoverPort: (e: MouseEvent, portType: "in" | "out", chIdx?: number) => void = () => {}
    export let onHoverPortEnd: () => void = () => {}
    export let onPortContextMenu: (e: MouseEvent, portType: "in" | "out", chIdx?: number) => void = () => {}

    const NODE_ICONS: Record<string, string> = {
        drawer_audio: "audio",
        playlist: "playlist",
        mic: "mic",
        metronome: "timer",
        desktop_audio: "volume",
        output_window: "display_settings",
        speaker: "volume",
        icecast: "cloud"
    }

    function getIcon(nodeTypeKey: string): string {
        return icon || NODE_ICONS[nodeTypeKey] || ""
    }

    $: activeColor = color || autoColor

    $: isChannel = nodeType === "channel" || nodeType === "merger"
    $: isInputCol = nodeType === "input"
    $: isOutputCol = nodeType === "output"
    $: isStartChannel = dragStartType === "channel" || dragStartType === "merger"

    $: hasInPort = nodeType !== "input" && (type !== "network" || isSubNode) && (!isSubNode || nodeType === "output")
    $: hasOutPort = nodeType !== "output" && (type !== "output_window" || isSubNode)

    $: hasValidPort = (dragStartType === "input" && hasInPort) || (dragStartType === "output" && hasOutPort) || (isStartChannel && ((dragStartPortType === "in" && hasOutPort) || (dragStartPortType === "out" && hasInPort)))
    $: isValidHover = isConnecting && ((dragStartType === "input" && isChannel) || (dragStartType === "output" && isChannel) || (isStartChannel && ((dragStartPortType === "in" && isInputCol) || (dragStartPortType === "out" && isOutputCol))))
</script>

<div
    {id}
    class="node-card {isChannel ? `context #audio_channel${id === 'main' ? '_main' : ''}` : type}"
    class:merger-card={isChannel}
    class:sub-card={isSubNode}
    class:hover-valid={hoverTargetId === id && hasValidPort}
    class:disabled={!isEnabled && !isInputCol}
    class:invalid={isConnecting && !isValidHover && id !== dragStartId}
    data-node-id={id}
    on:mouseenter={onMouseEnter}
    on:mouseleave={onMouseLeave}
    style="{activeColor ? `--port-color: ${activeColor};` : ''}{channels > 1 ? `min-height: ${channels * 30}px;` : ''}"
>
    {#if nodeType !== "input" && type !== "network" && !isSubNode}
        <div class="port port-in" on:mouseenter={(e) => onHoverPort(e, "in")} on:mouseleave={onHoverPortEnd} on:mousedown={(e) => onMouseDown(e, "in")} on:contextmenu={(e) => onPortContextMenu(e, "in")}></div>
    {/if}

    {#if isSubNode && nodeType === "output" && channels > 1}
        <div class="ports-column-in">
            {#each Array(channels) as _, chIdx}
                <div
                    class="port port-in port-multi"
                    data-ch-index={chIdx}
                    data-title="{translateText('midi.channel')} {chIdx + 1}"
                    on:mouseenter={(e) => {
                        onMouseEnterPort(e, chIdx)
                        onHoverPort(e, "in", chIdx)
                    }}
                    on:mouseleave={() => {
                        onMouseLeavePort()
                        onHoverPortEnd()
                    }}
                    on:mousedown={(e) => onMouseDown(e, "in", chIdx)}
                    on:contextmenu={(e) => onPortContextMenu(e, "in", chIdx)}
                ></div>
            {/each}
        </div>
    {:else if isSubNode && nodeType === "output"}
        <div class="port port-in" on:mouseenter={(e) => onHoverPort(e, "in")} on:mouseleave={onHoverPortEnd} on:mousedown={(e) => onMouseDown(e, "in")} on:contextmenu={(e) => onPortContextMenu(e, "in")}></div>
    {/if}

    <div class="card-content">
        {#if hasSubNodes && type !== "output_window" && type !== "network"}
            <MaterialButton variant="outlined" icon={isExpanded ? "expand" : "next"} style="padding: 5px;" on:click={onToggleExpand} />
        {/if}

        {#if isChannel}
            <span class="card-name" data-title={name}>{name}</span>
            {#if isMuted}
                <Icon id="muted" size={0.9} style="opacity: 0.7;" white />
            {/if}
        {:else}
            {#if !hasSubNodes}
                <Icon id={getIcon(type)} size={isSubNode ? 0.9 : 1.1} {color} white />
            {/if}
            <span class="card-name" data-title={name} class:sub-name={isSubNode}>{name}</span>
        {/if}

        {#if type === "desktop_audio"}
            <MaterialToggleSwitch label="" checked={isEnabled} on:change={(e) => onToggleEnabled?.(e.detail)} small />
        {/if}

        {#if type === "icecast" || isChannel}
            <MaterialButton
                variant="outlined"
                icon="options"
                style="padding: 5px;"
                title="popup.node_options"
                on:click={() => {
                    popupData.set({ nodeId: id, name })
                    activePopup.set("node_options")
                }}
            />
        {/if}
    </div>

    {#if id !== "network_default" && id !== "output_window" && isEnabled && (nodeType === "input" || hasInputConnection)}
        <AudioMeter channelId={id} />
    {/if}

    {#if nodeType !== "output" && (type !== "output_window" || isSubNode)}
        <div class="port port-out" on:mouseenter={(e) => onHoverPort(e, "out")} on:mouseleave={onHoverPortEnd} on:mousedown={(e) => onMouseDown(e, "out")} on:contextmenu={(e) => onPortContextMenu(e, "out")}></div>
    {/if}
</div>

<style>
    .node-card {
        position: relative;
        max-width: 500px;
        min-width: 200px;
        width: 100%;
        box-sizing: border-box;
        background: var(--primary-darker, rgba(30, 30, 40, 0.9));
        border: 1px solid rgba(255, 255, 255, 0.15);
        border-radius: 8px;
        padding: 10px 14px;
        box-shadow: 0 4px 10px rgba(0, 0, 0, 0.3);
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: stretch;
        gap: 8px;
        cursor: default;
        transition:
            border-color 0.15s ease,
            box-shadow 0.15s ease,
            opacity 0.2s ease;
    }

    .sub-card {
        background: rgba(20, 20, 30, 0.8);
        padding: 8px 12px;
    }

    .node-card:hover {
        border-color: rgba(255, 255, 255, 0.3);
    }

    .node-card.hover-valid {
        border-color: var(--text);
    }

    .node-card.disabled {
        opacity: 0.5;
    }

    .node-card.invalid {
        opacity: 0.3;
        pointer-events: none;
    }

    .card-content {
        display: flex;
        align-items: center;
        gap: 10px;
        width: 100%;
    }

    .card-name {
        font-weight: 500;
        flex: 1;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .sub-name {
        font-size: 0.9em;
        opacity: 0.9;
    }

    .expand-btn {
        background: none;
        border: none;
        color: inherit;
        cursor: pointer;
        padding: 0 4px;
        display: flex;
        align-items: center;
    }

    .port {
        position: absolute;
        width: 12px;
        height: 12px;
        background: var(--port-color, var(--secondary));
        /* border: 2px solid var(--text); */
        border: 2px solid var(--primary-darkest);
        border-radius: 50%;
        cursor: crosshair;
        z-index: 10;
        transition: background 0.1s ease;
    }
    .port:hover {
        background: var(--text);
    }

    .port-in {
        left: -7px;
        top: calc(50% - 6px);
    }

    .port-out {
        right: -7px;
        top: calc(50% - 6px);
    }

    .ports-column-in {
        position: absolute;
        left: -7px;
        top: 0;
        bottom: 0;
        display: flex;
        flex-direction: column;
        justify-content: space-around;
        padding: 4px 0;
    }

    .port-multi {
        position: relative;
        left: 0;
        top: 0;
        transform: none;
        margin: 2px 0;
    }
</style>
