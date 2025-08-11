<script lang="ts">
    import { createEventDispatcher } from "svelte"
    import { activePopup, popupData } from "../../stores"
    import { translateText } from "../../utils/language"
    import Icon from "../helpers/Icon.svelte"
    import T from "../helpers/T.svelte"
    import MaterialButton from "./MaterialButton.svelte"
    import type { Popups } from "../../../types/Main"

    export let label: string
    export let value: string
    export let nameObject: any = {}
    export let icon = ""
    export let popupId: Popups

    export let disabled = false
    export let allowEmpty = false

    const dispatch = createEventDispatcher()

    function openPopup() {
        if (disabled) return

        popupData.set({ active: value, trigger: (id) => dispatch("change", id) })
        activePopup.set(popupId)
    }

    // SELECT

    function handleKeydown(event: KeyboardEvent) {
        if (disabled) return

        if (event.key === "Enter" || event.key === " ") {
            event.preventDefault()
            openPopup()
            return
        }
    }
</script>

<div class="textfield {disabled ? 'disabled' : ''}" data-title={translateText(`popup.${popupId}`)}>
    <div class="background" />

    <div
        class="input edit button-trigger"
        role="button"
        tabindex={disabled ? undefined : 0}
        on:click={(e) => {
            if (e.target?.closest(".remove")) return
            openPopup()
        }}
        on:keydown={handleKeydown}
    >
        <span class="selected-text">
            {#if value}
                {#if icon}<Icon id={icon} />{/if}

                {#if nameObject[value]?.name ?? value}
                    {nameObject[value]?.name ?? value}
                {:else}
                    <span style="opacity: 0.7;font-style: italic;"><T id="main.unnamed" /></span>
                {/if}
            {/if}
        </span>

        <svg class="arrow" width="20" height="20" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
            <path d="M0 0h24v24H0z" fill="none" /><path d="M9 5v2h6.59L4 18.59 5.41 20 17 8.41V15h2V5z" />
        </svg>
    </div>

    <label class:selected={value}><T id={label} /></label>
    <span class="underline" />

    {#if allowEmpty && value}
        <div class="remove">
            <MaterialButton on:click={() => dispatch("change", null)} title="clear.general" white>
                <Icon id="close" size={1.2} white />
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
    }

    .background {
        position: absolute;
        inset: 0;
        background-color: var(--primary-darkest);
        border-radius: 4px 4px 0 0;
        z-index: 0;
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
