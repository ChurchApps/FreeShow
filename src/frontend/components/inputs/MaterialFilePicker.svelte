<script lang="ts">
    import { createEventDispatcher, onDestroy, onMount } from "svelte"
    import { uid } from "uid"
    import { Main } from "../../../types/IPC/Main"
    import { ToMain } from "../../../types/IPC/ToMain"
    import { destroyMain, receiveToMain, sendMain } from "../../IPC/main"
    import { translateText } from "../../utils/language"
    import Icon from "../helpers/Icon.svelte"
    import { getFileName } from "../helpers/media"
    import MaterialButton from "./MaterialButton.svelte"

    export let label: string
    export let value: string | undefined
    export let title: string = ""
    export let filter: { name: string; extensions: string[] }
    export let icon: string = ""
    export let multiple: boolean = false

    export let disabled = false
    export let autoTrigger = false
    export let allowEmpty = false

    onMount(() => {
        if (autoTrigger && !value) pickMedia()
    })

    function pickMedia() {
        if (disabled) return

        // filter: { name: "Text file", extensions: ["txt"], id: "txt" }
        sendMain(Main.OPEN_FILE, { channel: "MEDIA", id: PICK_ID, filter, multiple })
    }

    const PICK_ID = uid()
    const dispatch = createEventDispatcher()
    let listenerId = receiveToMain(ToMain.OPEN_FILE2, (data) => {
        if (data.id !== PICK_ID || data.channel !== "MEDIA" || !data.files?.length) return

        dispatch("change", multiple ? data.files : data.files[0])
    })
    onDestroy(() => destroyMain(listenerId))

    // SELECT

    function handleKeydown(event: KeyboardEvent) {
        if (disabled) return

        if (event.key === "Enter" || event.key === " ") {
            event.preventDefault()
            pickMedia()
            return
        }
    }
</script>

<div class="textfield {disabled ? 'disabled' : ''}" data-title={value || translateText(title || "edit.choose_media")}>
    <div class="background" />

    <div
        class="input edit button-trigger"
        role="button"
        tabindex={disabled ? undefined : 0}
        on:click={(e) => {
            if (e.target?.closest(".remove")) return
            pickMedia()
        }}
        on:keydown={handleKeydown}
    >
        <span class="selected-text">
            {#if value}{getFileName(value)}{/if}
        </span>

        <div class="arrow">
            {#if icon}
                <Icon id={icon} white />
            {:else}
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                    {#if multiple}
                        <path d="M0 0h24v24H0z" fill="none" /><path d="M22 16V4c0-1.1-.9-2-2-2H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2zm-11-4l2.03 2.71L16 11l4 5H8l3-4zM2 6v14c0 1.1.9 2 2 2h14v-2H4V6H2z" />
                    {:else}
                        <path d="M0 0h24v24H0z" fill="none" /><path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z" />
                    {/if}
                </svg>
            {/if}
        </div>
    </div>

    <label class:selected={value}>{@html translateText(label)}</label>
    <span class="underline" />

    {#if allowEmpty && value}
        <div class="remove">
            <MaterialButton on:click={() => dispatch("change", "")} title="clear.general" white>
                <Icon id="close" white />
            </MaterialButton>
        </div>
    {/if}
</div>

<style>
    .textfield {
        position: relative;
        width: 100%;
        color: var(--text);
        user-select: none;

        border-bottom: 1.2px solid var(--primary-lighter);

        height: 50px;
    }

    .background {
        position: absolute;
        inset: 0;
        background-color: var(--primary-darkest);
        border-radius: 4px 4px 0 0;
        z-index: 0;
    }

    .input {
        height: 100%;
    }

    .textfield:not(:has(.dropdown)):not(:has(.remove:hover)):not(:disabled):hover .input {
        background-color: var(--hover);
    }

    .button-trigger {
        position: relative;
        z-index: 1;
        width: 100%;
        padding: 1.25rem 0.75rem 0.5rem;
        font-size: 1rem;
        color: var(--text);
        display: flex;
        align-items: center;
        justify-content: space-between;
        cursor: pointer;
        background: transparent;
        border: none;
        outline: none;
    }

    .remove {
        position: absolute;
        top: 50%;
        right: 46px;
        transform: translateY(-50%);

        z-index: 2;
    }
    .remove :global(button) {
        padding: 0.75rem;
    }

    .selected-text {
        flex: 1;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;

        display: flex;
        align-items: center;
        gap: 8px;
    }

    .arrow {
        transition: transform 0.2s ease;
        color: var(--text);
        transform: translateY(-0.4rem);
    }

    label {
        position: absolute;
        left: 0.75rem;
        top: 0.75rem;
        font-size: 1.1rem;
        color: var(--text);
        opacity: 0.8;
        transition: all 0.2s ease;
        pointer-events: none;
        z-index: 1;
    }
    label.selected {
        top: 0.25rem;
        font-size: 0.75rem;
        color: var(--secondary);
        font-weight: 500;
        opacity: 1;
    }

    .underline {
        position: absolute;
        bottom: 0;
        left: 0;
        height: 1.2px;
        width: 100%;
        background-color: var(--secondary);
        transform: scaleX(0);
        transition: transform 0.2s ease;
        transform-origin: left;
        z-index: 2;

        pointer-events: none;
    }

    .textfield:not(:has(.remove:hover)):focus-within .underline {
        transform: scaleX(1);
    }
    .textfield:focus-within label {
        top: 0.25rem;
        font-size: 0.75rem;
        color: var(--secondary);
        font-weight: 500;
        opacity: 1;
    }

    .disabled {
        pointer-events: none;
        opacity: 0.35;
    }
</style>
