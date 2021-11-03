<script lang="ts">
  export let id: string
  export let side: "left" | "right" = "left"
  export let width: number = 300
  let defaultWidth: number = Number(width.toString())
  export let maxWidth: number = defaultWidth * 2
  export let minWidth: number = 4

  if (id) {
    // width = // get stored values ... stores
    // $panelWidth[id] = width....
  }

  // let symmetric: boolean = false // WIP

  let move: boolean = false
  let mouse: null | { x: number; y: number; offset: number; target: any } = null
  function mousedown(e: any) {
    if (
      (side === "left" && e.target.closest(".panel").offsetWidth - e.offsetX <= 4) ||
      (side === "right" && e.clientX < e.target.closest(".panel").offsetLeft + 4 && e.offsetX <= 4 && e.offsetX >= 0)
    ) {
      mouse = {
        x: e.clientX,
        y: e.clientY,
        offset: window.innerWidth - width - e.clientX,
        target: e.target,
      }
    }
  }

  function mousemove(e: any) {
    if (mouse) {
      let newWidth: number = window.innerWidth - e.clientX - mouse.offset
      if (side === "left") newWidth = e.clientX
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
        (side === "left" && e.target.closest(".panel").offsetWidth - e.offsetX <= 4) ||
        (side === "right" && e.clientX < e.target.closest(".panel").offsetLeft + 4 && e.offsetX >= 0)
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

<div class="panel bar_{side}" style="width: {width}px" on:mousedown={mousedown} on:click={click}>
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
    padding-right: 4px;
  }
  :global(.bar_right) {
    padding-left: 4px;
  }
  div::after {
    content: "";
    background-color: var(--primary-lighter);
    position: absolute;
    width: 4px;
    height: 100%;
    cursor: ew-resize;
  }
  :global(.bar_left)::after {
    right: 0;
  }
  :global(.bar_right)::after {
    left: 0;
  }
</style>
