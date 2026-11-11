<script lang="ts">
    export let index: number
    export let controller: any
    export let isPlaceholder = false
    export let selectedIndices: number[] = []
    export let handleOnly = false

    let elem: HTMLElement
    let isHandleMouseDown = false

    function onDragStart(e: DragEvent) {
        if (handleOnly && !isHandleMouseDown) {
            e.preventDefault()
            return
        }

        e.stopPropagation()
        if (e.dataTransfer && elem) {
            e.dataTransfer.effectAllowed = "move"
            e.dataTransfer.setData("text/plain", `${index}`)

            const rect = elem.getBoundingClientRect()
            const clone = elem.cloneNode(true) as HTMLElement
            clone.style.cssText = `position:fixed;top:-9999px;left:-9999px;width:${rect.width}px;height:${rect.height}px;pointer-events:none;opacity:1;`
            clone.classList.remove("is_placeholder", "drag_over")

            const count = selectedIndices.includes(index) && selectedIndices.length > 1 ? selectedIndices.length : 1
            if (count > 1) {
                const badge = document.createElement("span")
                badge.style.cssText = "position:absolute;top:4px;right:8px;background:var(--focus,#4d90fe);color:#fff;border-radius:10px;padding:2px 8px;font-size:12px;font-weight:bold;"
                badge.innerText = `${count}`
                clone.appendChild(badge)
            }

            document.body.appendChild(clone)
            e.dataTransfer.setDragImage(clone, Math.min(Math.max(10, e.clientX - rect.left), rect.width), Math.min(Math.max(10, e.clientY - rect.top), rect.height))
            setTimeout(() => clone.remove(), 0)
        }
        controller?.onDragStart(index, selectedIndices)
    }

    function onMouseDown(e: MouseEvent) {
        const target = e.target as HTMLElement | null
        isHandleMouseDown = !handleOnly || !!(target && target.closest(".drag_handle"))
    }
</script>

<div
    bind:this={elem}
    class="drag_item_wrapper {$$props.class || ''}"
    class:is_placeholder={isPlaceholder}
    draggable={!handleOnly || isHandleMouseDown}
    on:mousedown={onMouseDown}
    on:dragstart={onDragStart}
    on:dragover={(e) => {
        e.preventDefault()
        e.stopPropagation()
        if (e.dataTransfer) e.dataTransfer.dropEffect = "move"
        if (!isPlaceholder) controller?.onDragOver(index)
    }}
    on:drop={(e) => {
        e.preventDefault()
        e.stopPropagation()
        isHandleMouseDown = false
        controller?.onDrop(index)
    }}
    on:dragend={() => {
        isHandleMouseDown = false
        controller?.onDragEnd()
    }}
>
    <slot />
</div>

<style>
    .drag_item_wrapper {
        display: flex;
        flex-direction: column;
        width: 100%;
        box-sizing: border-box;
        transition: opacity 0.15s ease;
    }
    .drag_item_wrapper.is_placeholder {
        opacity: 0.35;
        border: 1px dashed var(--focus, #4d90fe);
        border-radius: 4px;
    }
</style>
