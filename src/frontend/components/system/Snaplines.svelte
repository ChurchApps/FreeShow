<script lang="ts">
  import { getStyles } from "../helpers/style"

  export let lines: [string, number][]
  export let mouse: any
  export let newStyles: any
  export let ratio: number
  export let active: any

  let snap: number = 8

  // TODO: snap on resize

  let styles: any = {}
  function mousemove(e: any) {
    if (mouse) {
      styles = {}
      let itemElem = mouse.e.target.closest(".item")
      if (mouse.e.target.closest(".line") || (!mouse.e.target.closest(".edit") && !mouse.e.target.closest(".square")) || mouse.e.ctrlKey || mouse.e.altKey) {
        e.preventDefault()
        styles.left = (e.clientX - itemElem.closest(".slide").offsetLeft) / ratio - mouse.offset.x
        styles.top = (e.clientY - itemElem.closest(".slide").offsetTop) / ratio - mouse.offset.y
        // styles.left = (itemElem.closest(".slide").offsetLeft) - mouse.offset.x / ratio
        // styles.top = (e.clientY - itemElem.closest(".slide").offsetTop) / ratio - mouse.offset.y

        if (!e.altKey) {
          let slideWidth = Math.round(itemElem.closest(".slide").offsetWidth / ratio)
          let slideHeight = Math.round(itemElem.closest(".slide").offsetHeight / ratio)

          // slide snap
          let xLines = [0, slideWidth / 2, slideWidth]
          let yLines = [0, slideHeight / 2, slideHeight]
          // item snap
          let xItems = [0, itemElem.offsetWidth / 2, itemElem.offsetWidth]
          let yItems = [0, itemElem.offsetHeight / 2, itemElem.offsetHeight]

          // TODO: gravit, snap to gaps++

          // get other items pos
          // $shows[$activeShow!.id].slides[layoutSlides[$activeEdit.slide!].id].items.forEach((itm, i) => {
          itemElem
            .closest(".slide")
            .querySelectorAll(".item")
            .forEach((item: any, i: number) => {
              let id = i
              if (item.id) id = item.id

              if (!active.includes(id)) {
                let style: any = getStyles(item.getAttribute("style"))
                Object.entries(style).map((s: any) => (style[s[0]] = Number(s[1].replace(/\D.+/g, ""))))
                xLines.push(style.left, style.left + style.width / 2, style.left + style.width)
                yLines.push(style.top, style.top + style.height / 2, style.top + style.height)
              }
            })

          checkMatch(xLines, xItems, "x")
          checkMatch(yLines, yItems, "y")
          // center is easier to snap to
          checkMatch([slideWidth / 2], [itemElem.offsetWidth / 2], "xc", (snap * 2) / ratio)
          checkMatch([slideHeight / 2], [itemElem.offsetHeight / 2], "yc", (snap * 2) / ratio)
        } else lines = []
        styles.left = styles.left.toFixed(2) + "px"
        styles.top = styles.top.toFixed(2) + "px"
      } else if (mouse.e.target.closest(".square")) {
        // TODO: shiftkey
        // TODO: snap to resize...
        let store = null
        let square = mouse.e.target.closest(".square")
        if (square.classList[1].includes("n")) {
          styles.top = (e.clientY - itemElem.closest(".slide").offsetTop) / ratio - mouse.offset.y
          // styles.height = e.clientY / ratio + (e.clientY - itemElem.closest(".slide").offsetTop) / ratio - mouse.offset.y + mouse.offset.height

          // styles.height = mouse.height - e.clientY / ratio + mouse.offset.height
          // styles.height = mouse.offset.height - e.clientY / ratio - styles.top
          // styles.height = mouse.offset.y - e.clientY / ratio + mouse.offset.y
          // styles.height = mouse.offset.height - e.clientY / ratio + mouse.offset.y
          // TODO: resize square
          // styles.height = mouse.offset.height - (e.clientY - itemElem.closest(".slide").offsetTop) / ratio + mouse.offset.y + mouse.height
          // styles.height = mouse.offset.height - (e.clientY - mouse.height) / ratio + mouse.offset.y
          styles.height = mouse.offset.height - (e.clientY - mouse.height + itemElem.closest(".slide").offsetTop) / ratio + mouse.offset.y
          // styles.height = 0 - e.clientY / ratio + mouse.offset.height
          if (e.shiftKey) store = e.clientY / ratio - mouse.offset.height
          // styles.height = e.clientY / ratio - mouse.offset.height
          // styles.height = e.clientY / ratio - mouse.offset.height - (e.clientY - itemElem.closest(".slide").offsetTop) / ratio - mouse.offset.y
          // styles.height = mouse.offset.y - itemElem.offsetHeight - (e.clientY - e.target.closest(".slide").offsetTop) / ratio
          // styles.height = mouse.offsetHeight - (e.clientY - e.target.closest(".slide").offsetTop) / ratio
          // styles.height = mouse.offsetHeight + itemElem.closest(".item").offsetHeight - (e.clientY - e.target.closest(".slide").offsetTop) / ratio
          // styles.height = mouse.offsetHeight + itemElem.closest(".item").offsetTop - (e.clientY - itemElem.closest(".slide").offsetTop) / ratio
        }
        if (square.classList[1].includes("e")) {
          // styles.width = (e.clientX - e.target.closest(".slide").offsetLeft) / ratio - mouse.offset.x
          if (!e.shiftKey || store === null) {
            styles.width = e.clientX / ratio - mouse.offset.width
            store = e.clientX / ratio - mouse.offset.width
          } else styles.width = store
        }
        if (square.classList[1].includes("s")) {
          // styles.height = e.clientY / ratio - mouse.offset.y + itemElem.offsetHeight

          if (!e.shiftKey || store === null) {
            styles.height = e.clientY / ratio - mouse.offset.height
            store = e.clientY / ratio - mouse.offset.height
          } else styles.height = store
        }
        if (square.classList[1].includes("w")) {
          styles.left = (e.clientX - itemElem.closest(".slide").offsetLeft) / ratio - mouse.offset.x
          // styles.width = e.clientX / ratio - mouse.offsetWidth
          // styles.width = mouse.offset.x - itemElem.offsetWidth - (e.clientX - e.target.closest(".slide").offsetLeft) / ratio

          if (!e.shiftKey || store === null) {
            // styles.width = mouse.offset.width - (e.clientX - itemElem.closest(".slide").offsetLeft) / ratio + mouse.offset.x + mouse.width
            styles.width = mouse.offset.width - (e.clientX - mouse.width + itemElem.closest(".slide").offsetLeft) / ratio + mouse.offset.x
            // styles.width = e.clientX / ratio - mouse.offset.width
            store = e.clientX / ratio - mouse.offset.width
          }
        }

        ;["top", "left", "width", "height"].forEach((value) => {
          if (styles[value] !== undefined && !styles[value].toString().includes("px")) {
            if (value === "width" || value === "height") styles[value] = Math.max(16 / ratio, styles[value])
            styles[value] = styles[value].toFixed(2) + "px"
          }
        })
      }
      newStyles = styles
    }
  }

  function checkMatch(allLines: number[], items: any[], id: string, margin: any = snap / ratio) {
    let side = id.includes("x") ? "left" : "top"
    allLines.forEach((l: number) => {
      let match = false
      items.find((i: any) => {
        if (styles[side] > l - i - margin && styles[side] < l - i + margin) {
          styles[side] = l - i
          match = true
        }
      })

      let linesInclude = lines
        .join(".")
        .replaceAll(",", "")
        .includes(id + l)
      if (match && !linesInclude) lines = [...lines, [id, l]]
      else if (!match && linesInclude) lines = lines.filter((m: any) => m.join("") !== id + l)
    })
  }

  function mouseup() {
    mouse = null
    lines = []
    newStyles = {}
  }
</script>

<svelte:window on:mousemove={mousemove} on:mouseup={mouseup} />

{#each lines as line}
  <div class="line {line[0]}" style="{line[0].includes('x') ? 'left' : 'top'}: {line[1]}px;" />
{/each}

<style>
  .line {
    position: absolute;
    top: 0;
    left: 0;
    z-index: 10;
    background-color: var(--secondary);
  }
  .line.x {
    width: 2px;
    height: 100%;
  }
  .line.xc {
    width: 5px;
    height: 100%;
  }
  .line.y {
    width: 100%;
    height: 2px;
  }
  .line.yc {
    width: 100%;
    height: 5px;
  }
</style>
