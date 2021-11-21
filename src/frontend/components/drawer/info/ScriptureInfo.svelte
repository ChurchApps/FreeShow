<script lang="ts">
  import type { Bible } from "../../../../types/Scripture"
  import type { Resolution } from "../../../../types/Settings"
  import type { Item } from "../../../../types/Show"
  import { screen } from "../../../stores"
  import Textbox from "../../slide/Textbox.svelte"

  export let bible: Bible
  $: sorted = bible.activeVerses.sort((a, b) => a - b)
  let range: any[][] = [[null, null]]

  let slideWidth: number = 300 - 20 - 5
  let resolution: Resolution = $screen.resolution
  $: zoom = slideWidth / resolution.width

  $: {
    console.log(bible.activeVerses.length)
    if (bible.activeVerses.length) {
      console.log(bible.activeVerses)
      console.log(sorted)
      range = [[sorted[0], null]]
      let prev: null | number = null
      let index = 0
      sorted.forEach((i) => {
        if (range[index][1] === null || i > range[index][1]) {
          console.log(prev, i)

          if (prev !== null && prev + 1 !== i) {
            index++
            range.push([i, null])
          }
          range[index][1] = i
          prev = i
        }
      })
      console.log(range)
    }
  }

  // TODO: update....
  let verseRange: string = ""
  $: {
    if (range[0][0] !== null) {
      let arr: string[] = []
      range.forEach((r) => {
        console.log(r, bible.verses[r[0]])

        if (bible.verses[r[0]][0] === bible.verses[r[1]][0]) arr.push(bible.verses[r[0]][0])
        else arr.push(bible.verses[r[0]][0] + "-" + bible.verses[r[1]][0])
      })
      verseRange = arr.join("+")
    }
  }

  let verseNumbers: boolean = true
  let versesPerSlide: number = 3
  let showVersion: boolean = true
  let showVerse: boolean = true
  let keepFormatting: boolean = false // red jesus words
  // TODO: break slide on text overflow!

  let slides: Item[][] = [[]]
  let itemStyle = "top: 150px;left: 50px;width: " + (resolution.width - 100) + "px;height: " + (resolution.height - 300) + "px;text-align: justify;align-items: center;"
  $: {
    if (sorted.length) {
      slides = [[{ text: [], style: itemStyle }]]
      sorted.forEach((s, i: number) => {
        let slideArr = slides[slides.length - 1][slides[slides.length - 1].length - 1]
        if (verseNumbers) slideArr.text!.push({ value: bible.verses[s][0] + " ", style: "font-size: 60px;color: gray;" })
        // TODO: html in {bible.verses[s][1]}
        let text = bible.verses[s][1]
        if (keepFormatting) {
          // TODO: formatting (already function in Scripture.svelte)
          text = text
        } else text = text.replace(/(<([^>]+)>)/gi, "")
        slideArr.text!.push({ value: text, style: "" })
        if (slideArr.text!.length / 2 >= versesPerSlide && sorted[i + 1]) {
          addVerse()
          slides.push([{ text: [], style: itemStyle }])
        }
      })
      addVerse()
    } else slides = [[]]
  }

  function addVerse() {
    let slideArr = slides[slides.length - 1]
    if (showVersion && bible.version) {
      slideArr.push({
        text: [{ value: bible.version, style: "font-size: 50px;" }],
        style: "left: 50px;bottom: 80px;width: " + (resolution.width - 100) + "px;justify-content: center;",
      })
    }
    if (showVerse) {
      slideArr.push({
        text: [{ value: bible.book + " " + bible.chapter + ":" + verseRange, style: "font-size: 50px;" }],
        style: "left: 50px;bottom: 20px;width: " + (resolution.width - 100) + "px;justify-content: center;",
      })
    }
  }
</script>

<div bind:offsetWidth={slideWidth} class="slide">
  <div style="zoom: {zoom};">
    {#if bible.activeVerses}
      {#each slides as items}
        {#each items as item}
          <Textbox {item} />
        {/each}
      {/each}
    {/if}
  </div>
</div>

{slides.length}
{bible.version}
{bible.book}
{bible.chapter}{#if verseRange.length}:{verseRange}{/if}
<!-- TODO: drag&drop slide(s) -->

<!-- settings: red jw, verse numbers, verse break, max verses per slide, show version, show book&chapter&verse, text formatting -->
<style>
  .slide {
    position: relative;
    background-color: black;
    font-size: 5em;

    width: 100%;
    height: auto;
    aspect-ratio: 16/9;
  }
</style>
