<script lang="ts">
    import { createEventDispatcher, onDestroy } from "svelte"
    import { uid } from "uid"
    import { Main } from "../../../types/IPC/Main"
    import { ToMain } from "../../../types/IPC/ToMain"
    import { destroyMain, receiveToMain, sendMain } from "../../IPC/main"
    import { activePopup, alertMessage, os } from "../../stores"
    import { translateText } from "../../utils/language"
    import Icon from "../helpers/Icon.svelte"
    import MaterialButton from "./MaterialButton.svelte"

    export let label: string
    export let value: string | undefined

    export let disabled = false
    export let allowEmpty = false

    function pickFolder() {
        if (disabled) return

        // linux dialog behind window message
        if ($os.platform === "linux" && $activePopup !== "initialize") {
            alertMessage.set("The folder select dialog might appear behind the window on Linux!<br>Please check that if you don't see it.")
            activePopup.set("alert")
        }

        sendMain(Main.OPEN_FOLDER, { channel: PICK_ID, title: translateText(label), path: value })
    }

    const PICK_ID = uid()
    const dispatch = createEventDispatcher()
    let listenerId = receiveToMain(ToMain.OPEN_FOLDER2, (data) => {
        if (data.channel !== PICK_ID || !data.path) return

        dispatch("change", data.path)
    })
    onDestroy(() => destroyMain(listenerId))

    // SELECT

    function handleKeydown(event: KeyboardEvent) {
        if (disabled) return

        if (event.key === "Enter" || event.key === " ") {
            event.preventDefault()
            pickFolder()
            return
        }
    }
</script>

<div class="textfield {disabled ? 'disabled' : ''}" data-title={value || translateText("inputs.change_folder")}>
    <div class="background" />

    <div
        class="input edit button-trigger"
        role="button"
        tabindex={disabled ? undefined : 0}
        on:click={(e) => {
            if (e.target?.closest(".button")) return
            pickFolder()
        }}
        on:keydown={handleKeydown}
    >
        <span class="selected-text">
            {value?.includes("Documents") ? value.slice(value.indexOf("Documents")) : value}
        </span>

        <svg class="arrow" width="18" height="18" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
            <path d="M0 0h24v24H0z" fill="none" /><path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z" />
        </svg>
    </div>

    <label class:selected={value}>{@html translateText(label)}</label>
    <span class="underline" />

    <div class="button">
        <MaterialButton on:click={() => sendMain(Main.SYSTEM_OPEN, value)} title="main.system_open" white>
            <Icon id="launch" white />
        </MaterialButton>
    </div>
    {#if allowEmpty && value}
        <div class="button remove">
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

    .textfield:not(:has(.dropdown)):not(:has(.button:hover)):not(:disabled):hover .input {
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

    .button {
        position: absolute;
        top: 50%;
        right: 46px;
        transform: translateY(-50%);

        z-index: 2;
    }
    .button :global(button) {
        padding: 0.75rem;
    }
    .button.remove {
        right: 90px;
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

    .textfield:not(:has(.button:hover)):focus-within .underline {
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
