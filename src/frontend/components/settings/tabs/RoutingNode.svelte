<script lang="ts">
    import Icon from "../../helpers/Icon.svelte"
    import MaterialTextInput from "../../inputs/MaterialTextInput.svelte"
    import AudioNodeVisualizer from "./AudioNodeVisualizer.svelte"

    export let id: string
    export let name: string
    export let type: string
    export let nodeType: "input" | "channel" | "merger" | "output"
    export let isSubNode: boolean = false
    export let isExpanded: boolean = false
    export let hasSubNodes: boolean = false
    export let hoverTargetId: string | null = null
    export let isConnecting: boolean = false
    export let dragStartId: string | null = null
    export let dragStartType: string | null = null
    export let dragStartPortType: "in" | "out" | null = null
    export let channels: number = 0
    export let isEnabled: boolean = true

    export let onToggleExpand: () => void = () => {}
    export let onMouseDown: (e: MouseEvent, portType: "in" | "out", chIdx?: number) => void
    export let onMouseEnter: (e: MouseEvent) => void
    export let onMouseLeave: () => void
    export let onMouseEnterPort: (e: MouseEvent, chIdx: number) => void = () => {}
    export let onMouseLeavePort: () => void = () => {}
    export let onRemove: () => void = () => {}
    export let onRename: (newName: string) => void = () => {}

    function getIcon(type: string): string {
        const icons: Record<string, string> = {
            drawer_audio: "audio",
            mic: "mic",
            metronome: "timer",
            desktop_audio: "screen",
            output_window: "display_settings",
            speaker: "volume",
            network: "connection",
            icecast: "cloud"
        }
        return icons[type] || "settings"
    }

    $: isChannel = nodeType === "channel" || nodeType === "merger"
    $: isValidHover = isConnecting && ((dragStartType === "input" && isChannel) || (dragStartType === "output" && isChannel) || (isChannel && dragStartPortType === "in" && nodeType === "input") || (isChannel && dragStartPortType === "out" && nodeType === "output"))
</script>

<div class="node-card" class:merger-card={isChannel} class:sub-card={isSubNode} class:hover-valid={hoverTargetId === id} class:disabled={!isEnabled} class:invalid={isConnecting && !isValidHover && id !== dragStartId} data-node-id={id} on:mouseenter={onMouseEnter} on:mouseleave={onMouseLeave}>
    {#if nodeType !== "input" && type !== "network" && !isSubNode}
        <div class="port port-in" title="Input connection port" on:mousedown={(e) => onMouseDown(e, "in")}></div>
    {/if}

    {#if isSubNode && nodeType === "output" && channels > 1}
        <div class="ports-column-in">
            {#each Array(channels) as _, chIdx}
                <div class="port port-in port-multi" data-ch-index={chIdx} title="Channel {chIdx + 1}" on:mouseenter={(e) => onMouseEnterPort(e, chIdx)} on:mouseleave={onMouseLeavePort} on:mousedown={(e) => onMouseDown(e, "in", chIdx)}></div>
            {/each}
        </div>
    {:else if isSubNode && nodeType === "output"}
        <div class="port port-in" title="Input connection port" on:mousedown={(e) => onMouseDown(e, "in")}></div>
    {/if}

    <div class="card-content">
        {#if hasSubNodes && type !== "output_window" && type !== "network"}
            <button class="expand-btn" on:click|stopPropagation={onToggleExpand}>
                <Icon id={isExpanded ? "expand" : "next"} size={0.9} />
            </button>
        {/if}

        {#if isChannel}
            {#if !hasSubNodes}
                <Icon id="options" size={1.1} />
            {/if}
            <MaterialTextInput label="Channel Name" value={name} style="margin: 0; width: 100%;" on:change={(e) => onRename(e.detail)} />
            {#if id !== "main" && id !== "merger_main" && id !== "channel_main"}
                <button class="delete-btn" title="Delete channel" on:click|stopPropagation={onRemove}>
                    <Icon id="delete" size={0.8} />
                </button>
            {/if}
        {:else}
            {#if !hasSubNodes}
                <Icon id={getIcon(type)} size={isSubNode ? 0.9 : 1.1} />
            {/if}
            <span class="card-name" class:sub-name={isSubNode}>{name}</span>
        {/if}
    </div>

    {#if id !== "network_default" && id !== "output_window"}
        <AudioNodeVisualizer channelId={id} width={isSubNode ? 120 : 140} height={isSubNode ? 3 : 4} />
    {/if}

    {#if nodeType !== "output" && (type !== "output_window" || isSubNode)}
        <div class="port port-out" title="Output connection port" on:mousedown={(e) => onMouseDown(e, "out")}></div>
    {/if}
</div>

<style>
    .node-card {
        position: relative;
        background: var(--primary-darker, rgba(30, 30, 40, 0.9));
        border: 1px solid rgba(255, 255, 255, 0.15);
        border-radius: 8px;
        padding: 10px 14px;
        box-shadow: 0 4px 10px rgba(0, 0, 0, 0.3);
        display: flex;
        flex-direction: column;
        align-items: stretch;
        gap: 8px;
        transition:
            border-color 0.15s ease,
            box-shadow 0.15s ease;
    }

    .sub-card {
        background: rgba(20, 20, 30, 0.8);
        padding: 8px 12px;
    }

    .node-card:hover {
        border-color: rgba(255, 255, 255, 0.3);
    }

    .node-card.hover-valid {
        border-color: #ff9800;
        box-shadow: 0 0 12px rgba(255, 152, 0, 0.5);
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

    .delete-btn {
        background: none;
        border: none;
        color: rgba(255, 255, 255, 0.5);
        cursor: pointer;
        padding: 2px;
        display: flex;
        align-items: center;
    }

    .delete-btn:hover {
        color: #f44336;
    }

    .port {
        position: absolute;
        width: 12px;
        height: 12px;
        background: #4caf50;
        border: 2px solid #fff;
        border-radius: 50%;
        cursor: crosshair;
        z-index: 10;
        transition: background 0.1s ease;
    }

    .port:hover {
        background: #ff9800;
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
