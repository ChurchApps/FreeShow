<script lang="ts">
    import { previewMode, previewOut, previewTransitionType } from "../../../stores"
    import { takeToProgram, fadeToProgram, cutToProgram, togglePreviewMode } from "../../helpers/previewProgram"
    import Button from "../../inputs/Button.svelte"
    import T from "../../helpers/T.svelte"

    $: hasPreviewContent = Object.keys($previewOut).length > 0
</script>

<div class="preview-program-bar" class:inactive={!$previewMode}>
    {#if $previewMode}
        <div class="transition-buttons">
            <button class="action-btn cut" class:active={$previewTransitionType === "cut"} on:click={cutToProgram} disabled={!hasPreviewContent} title="Cut (instant switch) [F5]"> CUT </button>
            <button class="action-btn fade" class:active={$previewTransitionType === "fade"} on:click={() => fadeToProgram()} disabled={!hasPreviewContent} title="Fade transition [F6]"> FADE </button>
        </div>

        <button class="action-btn take" on:click={() => takeToProgram()} disabled={!hasPreviewContent} title="Take preview to program [SPACE]"> TAKE </button>
    {/if}

    <div class="mode-toggle" class:standalone={!$previewMode}>
        <button class="action-btn mode" class:active={$previewMode} on:click={togglePreviewMode} title={$previewMode ? "Disable Preview/Program mode (direct output)" : "Enable Preview/Program mode (vMix workflow)"}>
            {$previewMode ? "PVW/PGM ON" : "⇄ PVW/PGM"}
        </button>
    </div>
</div>

<style>
    .preview-program-bar {
        display: flex;
        align-items: center;
        gap: 4px;
        padding: 4px 8px;
        background-color: var(--primary-darkest);
        border-top: 1px solid var(--primary-lighter);
    }

    .preview-program-bar.inactive {
        padding: 2px 8px;
        justify-content: flex-end;
        background-color: transparent;
        border-top: none;
    }

    .transition-buttons {
        display: flex;
        gap: 2px;
    }

    .action-btn {
        border: 1px solid var(--primary-lighter);
        background-color: var(--primary-darker);
        color: var(--text);
        padding: 6px 14px;
        border-radius: 4px;
        cursor: pointer;
        font-size: 0.85em;
        font-weight: 600;
        letter-spacing: 0.5px;
        transition:
            background-color 0.15s,
            border-color 0.15s;
        white-space: nowrap;
    }

    .action-btn:hover:not(:disabled) {
        background-color: var(--primary);
    }

    .action-btn:disabled {
        opacity: 0.4;
        cursor: not-allowed;
    }

    .action-btn.cut {
        color: #ff6b6b;
        border-color: #ff6b6b40;
    }
    .action-btn.cut:hover:not(:disabled) {
        background-color: #ff6b6b30;
    }

    .action-btn.fade {
        color: #ffd93d;
        border-color: #ffd93d40;
    }
    .action-btn.fade:hover:not(:disabled) {
        background-color: #ffd93d30;
    }

    .action-btn.take {
        flex: 1;
        padding: 8px 20px;
        font-size: 1em;
        background-color: #c0392b;
        color: white;
        border-color: #e74c3c;
    }
    .action-btn.take:hover:not(:disabled) {
        background-color: #e74c3c;
    }
    .action-btn.take:disabled {
        background-color: #5a2d2d;
        border-color: #7a3d3d;
    }

    .action-btn.mode {
        font-size: 0.75em;
        padding: 4px 8px;
        color: #6dff85;
        border-color: #6dff8540;
    }
    .action-btn.mode.active {
        background-color: #6dff8520;
    }
    .action-btn.mode:hover {
        background-color: #6dff8530;
    }

    .mode-toggle {
        margin-left: auto;
    }
</style>
