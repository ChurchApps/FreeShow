<script lang="ts">
    import { EFFECTS_LIST, getEffectStack, moveEffectInStack, toggleEffectInStack } from "../../../audio/effects/audioEffectsHelpers"
    import { activeAudioEffects, activePopup, audioEffects, popupData } from "../../../stores"
    import { translateText } from "../../../utils/language"
    import Icon from "../../helpers/Icon.svelte"
    import T from "../../helpers/T.svelte"
    import Button from "../../inputs/Button.svelte"
    import MaterialButton from "../../inputs/MaterialButton.svelte"
    import Center from "../../system/Center.svelte"

    $: channelId = $activeAudioEffects || "main"
    $: stack = getEffectStack($audioEffects, channelId)

    function openEffectPopup(effectItem: any) {
        popupData.set({
            channelId,
            effectId: effectItem.id,
            effect: effectItem.type
        })
        activePopup.set("audio_effect")
    }

    function openAddPopup() {
        popupData.set({ channelId })
        activePopup.set("add_audio_effect")
    }

    function handleToggle(item: any) {
        toggleEffectInStack(item.id, channelId)
    }

    function handleUp(index: number) {
        if (index > 0) {
            moveEffectInStack(index, index - 1, channelId)
        }
    }

    function handleDown(index: number) {
        if (index < stack.length - 1) {
            moveEffectInStack(index, index + 1, channelId)
        }
    }
</script>

<!-- header (go back) -->
<Button on:click={() => activeAudioEffects.set("")} center dark>
    <Icon id="back" right />
    <T id="actions.back" />
</Button>

<div class="stack-list">
    {#each stack as effectItem, i (effectItem.id || `${effectItem.type}_${i}`)}
        {@const meta = EFFECTS_LIST.find((e) => e.id === effectItem.type) || { label: effectItem.type, color: "var(--secondary)" }}
        {@const isEnabled = effectItem.enabled !== false}

        <div
            class="effect-card context #audio_effect_item"
            id={effectItem.id}
            data-index={i}
            data-channel={channelId}
            class:bypassed={!isEnabled}
            style="--accent-color: {meta.color};"
            on:click={() => openEffectPopup(effectItem)}
            role="button"
            tabindex={0}
            on:keydown={(e) => {
                if (e.key === "Enter" || e.key === " ") openEffectPopup(effectItem)
            }}
        >
            <div class="effect-info">
                <span class="slot-number">{i + 1}</span>
                <span class="effect-name">{translateText(meta.label)}</span>
            </div>

            <!-- stopPropagation prevents popup from opening -->
            <div class="effect-actions" role="none" on:click|stopPropagation={() => {}}>
                <!-- rearrange -->
                <MaterialButton disabled={i === stack.length - 1} title="actions.backward" style="padding: 6px;" on:click={() => handleDown(i)}>
                    <Icon id="down" size={0.8} white />
                </MaterialButton>
                <MaterialButton disabled={i === 0} title="actions.forward" style="padding: 6px;" on:click={() => handleUp(i)}>
                    <Icon id="up" size={0.8} white />
                </MaterialButton>

                <!-- power button -->
                <MaterialButton style="padding: 3px;margin: 4px;min-height: initial;border: 1px solid var(--primary-lighter);background-color: {isEnabled ? 'var(--connected)' : 'var(--primary-lighter)'} !important;" title="actions.{isEnabled ? 'disable' : 'enable'}" on:click={() => handleToggle(effectItem)}></MaterialButton>
            </div>
        </div>
    {/each}

    {#if stack.length === 0}
        <Center padding={10} faded>
            <T id="empty.general" />
        </Center>
    {/if}
</div>

<!-- Add Effect Button -->
<div class="add-section">
    <MaterialButton variant="outlined" style="width: 100%;padding: 8px;" on:click={openAddPopup}>
        <Icon id="add" size={0.9} />
        <span><T id="new.effect" /></span>
    </MaterialButton>
</div>

<style>
    .stack-list {
        display: flex;
        flex-direction: column;

        padding: 10px;
        padding-bottom: 0;
        /* border-radius: 8px; */
    }

    .effect-card {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 2px 4px;
        background-color: var(--primary-darker);
        border: 1px solid var(--primary-lighter);
        border-left: 4px solid var(--accent-color);
        border-radius: 4px;
        cursor: pointer;
        transition: all 0.15s ease;
        user-select: none;
    }

    .effect-card:hover {
        background-color: var(--primary);
    }

    .effect-card.bypassed {
        border-left-color: #555555;
    }

    .effect-info {
        display: flex;
        align-items: center;
        gap: 4px;
        flex: 1;
        min-width: 0;
    }

    .slot-number {
        font-size: 0.6em;
        opacity: 0.5;
        min-width: 16px;
        text-align: center;
    }

    .effect-name {
        font-size: 0.88em;
        font-weight: 500;
        color: var(--text);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .effect-actions {
        display: flex;
        align-items: center;
        gap: 2px;
        flex-shrink: 0;
    }

    .add-section {
        padding: 0 10px;
        padding-top: 4px;
    }
</style>
