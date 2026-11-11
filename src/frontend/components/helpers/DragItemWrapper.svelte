<script lang="ts">
    export let index: number
    export let controller: any
    export let isPlaceholder = false
    export let selectedIndices: number[] = []

    let elem: HTMLElement

    function onDragStart(e: DragEvent) {
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
</script>

<div
    bind:this={elem}
    class="drag_item_wrapper {$$props.class || ''}"
    class:is_placeholder={isPlaceholder}
    draggable="true"
    on:dragstart={onDragStart}
    on:dragover={(e) => {
        e.preventDefault()
        e.stopPropagation()
        if (e.dataTransfer) e.dataTransfer.dropEffect = "move"
        controller?.onDragOver(index)
    }}
    on:drop={(e) => {
        e.preventDefault()
        e.stopPropagation()
        controller?.onDrop(index)
    }}
    on:dragend={() => controller?.onDragEnd()}
>
    <slot />
</div>

<style>
    .drag_item_wrapper {
        display: flex;
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
