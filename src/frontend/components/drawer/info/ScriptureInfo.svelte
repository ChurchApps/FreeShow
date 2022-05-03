<script lang="ts">
  import { uid } from "uid"
  import type { Bible } from "../../../../types/Scripture"
  import type { Resolution } from "../../../../types/Settings"
  import type { Item } from "../../../../types/Show"
  import { ShowObj } from "../../../classes/Show"
  import { activeProject, categories, screen } from "../../../stores"
  import { history } from "../../helpers/history"
  import Icon from "../../helpers/Icon.svelte"
  import { checkName } from "../../helpers/show"
  import T from "../../helpers/T.svelte"
  import Button from "../../inputs/Button.svelte"
  import Checkbox from "../../inputs/Checkbox.svelte"
  import NumberInput from "../../inputs/NumberInput.svelte"
  import Textbox from "../../slide/Textbox.svelte"
  import Zoomed from "../../slide/Zoomed.svelte"

  export let bible: Bible
  $: sorted = bible.activeVerses.sort((a, b) => a - b)
  let range: any[][] = [[null, null]]

  // let slideWidth: number = 300 - 20 - 5
  let resolution: Resolution = $screen.resolution
  // $: zoom = slideWidth / resolution.width

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
        if (bible.verses[r[0]][0] === bible.verses[r[1]][0]) arr.push(bible.verses[r[0]][0])
        else arr.push(bible.verses[r[0]][0] + "-" + bible.verses[r[1]][0])
      })
      verseRange = arr.join("+")
    }
  }

  // settings
  let verseNumbers: boolean = false
  let versesPerSlide: number = 3
  let showVersion: boolean = false
  let showVerse: boolean = true
  let redJesus: boolean = false // red jesus words
  // TODO: break slide on text overflow!

  let slides: Item[][] = [[]]
  // let slides: any = {}
  // let values: any[][] = []
  // let itemStyle = "top: 150px;left: 50px;width: " + (resolution.width - 100) + "px;height: " + (resolution.height - 300) + "px;"
  let itemStyle = "top: 150px;left: 50px;width: " + (resolution.width - 100) + "px;height: " + (resolution.height - 300) + "px;"
  $: {
    if (sorted.length) {
      slides = [[{ lines: [{ text: [], align: "text-align: justify;" }], style: itemStyle }]]
      sorted.forEach((s, i: number) => {
        let slideArr = slides[slides.length - 1][slides[slides.length - 1].length - 1]
        if (verseNumbers) {
          let size = 50
          if (i === 0) size *= 2
          slideArr.lines![0].text.push({ value: bible.verses[s][0] + " ", style: "font-size: " + size + "px;color: gray;" })
        }
        // TODO: use template
        // TODO: html in {bible.verses[s][1]}
        let text = bible.verses[s][1]
        if (redJesus) {
          // TODO: formatting (already function in Scripture.svelte)
          text = text
        } else text = text.replace(/(<([^>]+)>)/gi, "")
        if (text.charAt(text.length - 1) !== " ") text += " "
        slideArr.lines![0].text.push({ value: text, style: "font-size: 80px;" })
        let verseCount = slideArr.lines![0].text.length / (verseNumbers ? 2 : 1)
        if (verseCount >= versesPerSlide && sorted[i + 1]) {
          let range: any[] = [...Array(versesPerSlide)].map((_a, j) => sorted[i - j]).sort((a, b) => a - b)

          let rangeJoined: any[][] = []
          range.forEach((r, i) => {
            if (rangeJoined[rangeJoined.length - 1] && r - 1 === range[i - 1]) rangeJoined[rangeJoined.length - 1].push(r)
            else rangeJoined.push([r])
          })
          console.log(rangeJoined)
          // TODO: sometimes only showing last verse number...

          let arr: any[] = []
          rangeJoined.forEach((r) => {
            if (bible.verses[r[0]][0] === bible.verses[r[r.length - 1]][0]) arr.push(bible.verses[r[0]][0])
            else arr.push(bible.verses[r[0]][0] + "-" + bible.verses[r[r.length - 1]][0])
          })

          addVerse(showVersion, showVerse, arr.join("+"))
          slides.push([{ lines: [{ text: [], align: "text-align: justify;" }], style: itemStyle }])
        }
      })
      // TODO: last range is now full text....
      // TODO: get correct verses at last slide
      // let remainder = sorted.length % versesPerSlide

      addVerse(showVersion, showVerse, verseRange)
    } else slides = [[]]
  }

  function addVerse(showVersion: boolean, showVerse: boolean, range: string) {
    let lines = []
    if (showVersion && bible.version) lines.push({ text: [{ value: bible.version, style: "font-size: 50px;" }], align: "" })
    if (showVerse) lines.push({ text: [{ value: bible.book + " " + bible.chapter + ":" + range, style: "font-size: 50px;" }], align: "" })
    if ((showVersion && bible.version) || showVerse)
      slides[slides.length - 1].push({ lines, style: "left: 50px;height: 150px;top: " + (resolution.height - 170) + "px;width: " + (resolution.width - 100) + "px;opacity: 0.8;" })
  }

  function createShow() {
    if (verseRange) {
      let newData = createSlides()
      history({ id: "newShow", newData, location: { page: "show", project: $activeProject || undefined } })
    }
  }

  function createSlides() {
    let slides2: any = {}
    let layouts: any[] = []
    slides.forEach((items: any) => {
      let id = uid()
      // TODO: group as verse numbers
      slides2[id] = { group: items[0].lines[0].text[0].value.split(" ").slice(0, 4).join(" "), color: null, settings: {}, notes: "", items }
      let l: any = { id }
      layouts.push(l)
    })

    let layoutID = uid()
    // TODO: private!!!?
    let show = new ShowObj(false, "scripture", layoutID)
    // add scripture category
    if (!$categories.scripture) {
      categories.update((a) => {
        a.scripture = { name: "category.scripture", icon: "scripture", default: true }
        return a
      })
    }

    // TODO: if name exists create new layout!!
    // TODO: keep same chapter on same show (just add new layouts...?)
    show.name = checkName(bible.book + " " + bible.chapter + "," + verseRange)
    show.slides = slides2
    show.layouts = { [layoutID]: { name: bible.version, notes: "", slides: layouts } }
    return { show }
  }

  const checked = (e: any) => {
    let val = e.target.checked
    let id = e.target.id
    if (id === "verse_numbers") verseNumbers = val
    else if (id === "show_version") showVersion = val
    else if (id === "show_verse") showVerse = val
    else if (id === "red_jesus") redJesus = val
  }
</script>

<Zoomed style="width: 100%;">
  {#if bible.activeVerses}
    <!-- {#each slides as items} -->
    {#each slides[0] as item}
      <Textbox {item} ref={{ id: "scripture" }} />
    {/each}
    <!-- {/each} -->
  {/if}
</Zoomed>

{bible.version}
<br />
{bible.book}
{bible.chapter}{#if verseRange.length}:{verseRange}{/if}
<!-- TODO: drag&drop slide(s) -->

<!-- settings: red jw, verse numbers, verse break, max verses per slide, show version, show book&chapter&verse, text formatting -->
<!-- settings -->
<div class="settings">
  <span>
    <p><T id="scripture.max_verses" /></p>
    <NumberInput value={versesPerSlide} min={1} max={20} on:change={(e) => (versesPerSlide = e.detail)} />
    <!-- font size... -->
  </span>
  <span>
    <p><T id="scripture.verse_numbers" /></p>
    <Checkbox id="verse_numbers" checked={verseNumbers} on:change={checked} />
  </span>
  <span>
    <p><T id="scripture.version" /></p>
    <Checkbox id="show_version" checked={showVersion} on:change={checked} />
  </span>
  <span>
    <p><T id="scripture.reference" /></p>
    <Checkbox id="show_verse" checked={showVerse} on:change={checked} />
  </span>
  <span>
    <p><T id="scripture.red_jesus" /> (WIP)</p>
    <Checkbox id="red_jesus" checked={redJesus} on:change={checked} />
  </span>
</div>

<Button on:click={createShow} disabled={!verseRange} dark center>
  <Icon id="show" right />
  <T id="new.show" /><span style="opacity: 0.6;margin-left: 10px;">({slides.length})</span>
</Button>

<style>
  .settings {
    display: flex;
    flex-direction: column;
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
    gap: 5px;
  }
  .settings span {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
</style>
