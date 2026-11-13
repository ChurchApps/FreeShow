<script lang="ts">
    import { EFFECTS_LIST, getEffectStack, toggleEffectInStack } from "../../../audio/effects/audioEffectsHelpers"
    import { activeAudioEffects, activePopup, audioEffects, popupData } from "../../../stores"
    import { translateText } from "../../../utils/language"
    import DragItemWrapper from "../../helpers/DragItemWrapper.svelte"
    import { createDragReorder } from "../../helpers/dragReorder"
    import Icon from "../../helpers/Icon.svelte"
    import T from "../../helpers/T.svelte"
    import Button from "../../inputs/Button.svelte"
    import MaterialButton from "../../inputs/MaterialButton.svelte"
    import Center from "../../system/Center.svelte"

    $: channelId = $activeAudioEffects || "main"
    $: stack = getEffectStack($audioEffects, channelId)

    const dragReorder = createDragReorder((fromIndices, toIndex) => {
        const reordered = dragReorder.getReorderedList(stack, fromIndices, toIndex)
        audioEffects.update((all) => {
            return { ...all, [channelId]: { ...(all[channelId] || {}), stack: reordered } }
        })
    })
    const { dragOverIndex, draggedIndices } = dragReorder
    $: displayStack = dragReorder.getReorderedList(stack, $draggedIndices, $dragOverIndex)

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
</script>

<!-- header (go back) -->
<Button on:click={() => activeAudioEffects.set("")} center dark>
    <Icon id="back" right />
    <T id="actions.back" />
</Button>

<div class="stack-list">
    {#each displayStack as effectItem, i (effectItem.id || `${effectItem.type}_${i}`)}
        {@const meta = EFFECTS_LIST.find((e) => e.id === effectItem.type) || { label: effectItem.type, color: "var(--secondary)" }}
        {@const isEnabled = effectItem.enabled !== false}
        {@const isPlaceholder = $dragOverIndex !== null && $draggedIndices.some((dIdx) => (effectItem.id ? effectItem.id === stack[dIdx]?.id : effectItem === stack[dIdx]))}

        <DragItemWrapper index={i} controller={dragReorder} {isPlaceholder}>
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
                    {#if displayStack.length > 1}
                        <Icon id="drag" style="opacity: 0.5;" white />
                    {/if}

                    <span class="effect-name">{translateText(meta.label)}</span>
                </div>

                <!-- stopPropagation prevents popup from opening -->
                <div class="effect-actions" role="none" on:click|stopPropagation={() => {}}>
                    <span class="slot-number">{i + 1}</span>

                    <!-- power button -->
                    <MaterialButton style="padding: 3px;margin: 4px;min-height: initial;border: 1px solid var(--primary-lighter);background-color: {isEnabled ? 'var(--connected)' : 'var(--primary-lighter)'} !important;" title="actions.{isEnabled ? 'disable' : 'enable'}" on:click={() => handleToggle(effectItem)}></MaterialButton>
                </div>
            </div>
        </DragItemWrapper>
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
        padding: 4px 5px;
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
        padding-left: 2px;
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
