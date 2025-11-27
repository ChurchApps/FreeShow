<script lang="ts">
    import { createEventDispatcher } from "svelte"

    export let items: any[] = []

    let sortableList: HTMLElement | null = null
    let draggedItem: HTMLElement | null = null
    let dragIndex: number = -1

    const dispatch = createEventDispatcher()

    $: if (sortableList) setupDragListeners()

    function setupDragListeners() {
        if (!sortableList) return

        sortableList.addEventListener("dragstart", onDragStart)
        sortableList.addEventListener("dragend", onDragEnd)
        sortableList.addEventListener("dragover", onDragOver)
    }

    function onDragStart(e: Event) {
        const target = e.target as HTMLElement
        draggedItem = target
        target.style.opacity = "0.5"
        dragIndex = parseInt(target.getAttribute("id") || "-1", 10)
    }

    function onDragEnd() {
        if (!sortableList) return

        if (draggedItem) draggedItem.style.opacity = ""
        draggedItem = null

        // create the new order of items based on the DOM structure
        const newItems = Array.from(sortableList.children)
            .map(child => {
                const id = child.getAttribute("id")
                return id ? items[parseInt(id)] : null
            })
            .filter(Boolean)

        const dropIndex = Array.from(sortableList.children).findIndex(child => child.getAttribute("id") === String(dragIndex))

        dispatch("end", { dragIndex, dropIndex, item: items[dragIndex], items: newItems })

        dragIndex = -1
    }

    function onDragOver(e: DragEvent) {
        e.preventDefault()
        if (!sortableList || !draggedItem) return

        const afterElement = getDragAfterElement(sortableList, e.clientY)
        if (afterElement == null) sortableList.appendChild(draggedItem)
        else sortableList.insertBefore(draggedItem, afterElement)
    }

    function getDragAfterElement(container: HTMLElement, y: number): HTMLElement | null {
        const elements = Array.from(container.querySelectorAll<HTMLElement>("li:not(.dragging)"))

        return elements.reduce(
            (closest, child) => {
                const box = child.getBoundingClientRect()
                const offset = y - box.top - box.height / 2
                return offset < 0 && offset > closest.offset ? { offset, element: child } : closest
            },
            { offset: Number.NEGATIVE_INFINITY, element: null as HTMLElement | null }
        ).element
    }
</script>

<ul id="sortable" bind:this={sortableList}>
    {#each items as item, i}
        <li id={i.toString()} draggable="true" style="-webkit-user-drag: element;">
            <!-- <Icon id="dragHandle" white /> -->
            <slot {item} />
        </li>
    {/each}
</ul>

<style>
    #sortable {
        list-style: none;
        padding: 0;
    }

    #sortable li {
        position: relative;

        display: flex;
        align-items: center;
        gap: 0.5rem;

        cursor: grab;
    }
</style>
