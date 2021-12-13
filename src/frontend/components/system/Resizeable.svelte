<script lang="ts">
  export let id: string
  export let side: "left" | "right" | "top" | "bottom" = "left"
  export let width: number = 300
  let defaultWidth: number = Number(width.toString())
  export let maxWidth: number = defaultWidth * 2
  let handleWidth: number = 4
  export let minWidth: number = handleWidth

  $: {
    if (width <= 8) handleWidth = 8
    else handleWidth = 4
  }

  if (id) {
    // width = // get stored values ... stores
    // $panelWidth[id] = width....
  }

  // let symmetric: boolean = false // WIP

  let move: boolean = false
  let mouse: null | { x: number; y: number; offset: number; target: any } = null
  function mousedown(e: any) {
    if (
      (side === "left" && e.target.closest(".panel")?.offsetWidth - e.offsetX <= handleWidth) ||
      (side === "right" && e.clientX < e.target.closest(".panel")?.offsetLeft + handleWidth && e.offsetX <= handleWidth && e.offsetX >= 0) ||
      (side === "top" && e.target.closest(".panel")?.offsetHeight - e.offsetY <= handleWidth) ||
      (side === "bottom" &&
        e.clientY < e.target.closest(".panel")?.offsetTop + e.target.closest(".panel")?.offsetParent.offsetTop + handleWidth &&
        e.offsetY <= handleWidth &&
        e.offsetY >= 0)
    ) {
      let offset = window.innerWidth - width - e.clientX
      if (side === "top" || side === "bottom") offset = window.innerHeight - width - e.clientY
      mouse = {
        x: e.clientX,
        y: e.clientY,
        offset,
        target: e.target,
      }
    }
  }

  function mousemove(e: any) {
    if (mouse) {
      let newWidth: number = window.innerWidth - e.clientX - mouse.offset
      if (side === "left") newWidth = e.clientX
      else if (side === "top") newWidth = e.clientY
      else if (side === "bottom") newWidth = window.innerHeight - e.clientY - mouse.offset
      // console.log(window.innerWidth, e.clientX, mouse.offsetX)

      if (newWidth < (defaultWidth * 0.6) / 2) newWidth = minWidth
      else if (newWidth < defaultWidth * 0.6) newWidth = defaultWidth * 0.6
      else if (newWidth > defaultWidth - 20 && newWidth < defaultWidth + 20) newWidth = defaultWidth
      else if (newWidth > maxWidth) newWidth = maxWidth
      else move = true
      width = newWidth
      // storeWidth = null
    }
  }

  let storeWidth: null | number = null
  function click(e: any) {
    if (!move) {
      if (
        (side === "left" && e.target.closest(".panel")?.offsetWidth - e.offsetX <= handleWidth) ||
        (side === "right" && e.clientX < e.target.closest(".panel")?.offsetLeft + handleWidth && e.offsetX <= handleWidth && e.offsetX >= 0) ||
        (side === "top" && e.clientY < e.target.closest(".panel")?.offsetTop + handleWidth && e.offsetY <= handleWidth && e.offsetY >= 0) ||
        (side === "bottom" &&
          e.clientY < e.target.closest(".panel")?.offsetTop + e.target.closest(".panel")?.offsetParent.offsetTop + handleWidth &&
          e.offsetY <= handleWidth &&
          e.offsetY >= 0)
      ) {
        if (width > minWidth) {
          storeWidth = width
          width = minWidth
        } else {
          if (storeWidth === null || storeWidth < defaultWidth / 2) width = defaultWidth
          else width = storeWidth
          storeWidth = null
        }
      } else move = false
    } else move = false
  }

  function mouseup(e: any) {
    mouse = null
    if (!e.target.closest(".panel")) move = false
  }
</script>

<svelte:window on:mouseup={mouseup} on:mousemove={mousemove} />

<div
  class="panel bar_{side}"
  style="{side === 'left' || side === 'right' ? 'width' : 'height'}: {width}px; --handle-width: {handleWidth}px"
  class:zero={width <= handleWidth}
  on:mousedown={mousedown}
  on:click={click}
>
  <slot />
</div>

<style>
  div {
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    overflow: hidden;
    position: relative;
  }
  :global(.bar_left) {
    padding-right: var(--handle-width);
  }
  :global(.bar_right) {
    padding-left: var(--handle-width);
  }
  :global(.bar_top) {
    padding-bottom: var(--handle-width);
  }
  :global(.bar_bottom) {
    padding-top: var(--handle-width);
  }
  div::after {
    content: "";
    background-color: var(--primary-lighter);
    position: absolute;
    width: 100%;
    height: 100%;
  }
  .zero::after {
    background-color: var(--secondary);
  }
  div:global(.bar_left)::after {
    right: 0;
    width: var(--handle-width);
    cursor: ew-resize;
  }
  div:global(.bar_right)::after {
    left: 0;
    width: var(--handle-width);
    cursor: ew-resize;
  }
  div:global(.bar_top)::after {
    bottom: 0;
    height: var(--handle-width);
    cursor: ns-resize;
  }
  div:global(.bar_bottom)::after {
    top: 0;
    height: var(--handle-width);
    cursor: ns-resize;
  }
</style>
