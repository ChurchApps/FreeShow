<script lang="ts">
  import { uid } from "uid"
  import type { Bible } from "../../../../types/Scripture"
  import type { Item } from "../../../../types/Show"
  import { ShowObj } from "../../../classes/Show"
  import { activeProject, categories, outLocked, scriptureSettings, templates } from "../../../stores"
  import { history } from "../../helpers/history"
  import Icon from "../../helpers/Icon.svelte"
  import { setOutput } from "../../helpers/output"
  import { checkName } from "../../helpers/show"
  import T from "../../helpers/T.svelte"
  import Button from "../../inputs/Button.svelte"
  import Checkbox from "../../inputs/Checkbox.svelte"
  import Color from "../../inputs/Color.svelte"
  import Dropdown from "../../inputs/Dropdown.svelte"
  import NumberInput from "../../inputs/NumberInput.svelte"
  import Textbox from "../../slide/Textbox.svelte"
  import Zoomed from "../../slide/Zoomed.svelte"

  export let bible: Bible
  $: sorted = bible.activeVerses.sort((a, b) => Number(a) - Number(b))

  let verseRange = ""
  $: {
    if (sorted.length) verseRange = joinRange(sorted)
    else verseRange = ""
  }

  function joinRange(array: string[]) {
    let prev: number = -1
    let range: string = ""
    array.forEach((a: string, i: number) => {
      if (Number(a) - 1 === prev) {
        if (i + 1 === array.length) range += "-" + a
      } else {
        if (range.length) {
          if (prev !== Number(range[range.length - 1])) range += "-" + prev
          range += "+"
        }
        range += a
      }
      prev = Number(a)
    })
    return range
  }

  // settings
  // let verseNumbers: boolean = false
  // let versesPerSlide: number = 3
  // let showVersion: boolean = false
  // let showVerse: boolean = true
  // let redJesus: boolean = false // red jesus words

  let slides: Item[][] = [[]]
  // let slides: any = {}
  // let values: any[][] = []
  // let itemStyle = "top: 150px;left: 50px;width: " + (resolution.width - 100) + "px;height: " + (resolution.height - 300) + "px;"
  $: template = $templates[$scriptureSettings.template]?.items || []
  $: itemStyle = template[0]?.style || "top: 150px;left: 50px;width: 1820px;height: 780px;"
  $: {
    if (sorted.length || $scriptureSettings) getSlides()
    else slides = [[]]
  }
  function getSlides() {
    slides = [[{ lines: [{ text: [], align: template[0]?.lines?.[0].align || "text-align: justify;" }], style: itemStyle }]]

    sorted.forEach((s: any, i: number) => {
      let slideArr = slides[slides.length - 1][slides[slides.length - 1].length - 1]

      if ($scriptureSettings.verseNumbers) {
        let size = 50
        if (i === 0) size *= 2
        slideArr.lines![0].text.push({
          value: s + " ",
          style: "font-size: " + size + "px;color: " + ($scriptureSettings.numberColor || "#919191") + ";" + template[0]?.lines?.[0].text?.[0].style || "",
        })
      }

      let text: string = bible.verses[s] || ""
      // TODO: formatting (already function in Scripture.svelte)
      // if (redJesus) {
      //   text = text
      // } else
      text = text.replace(/(<([^>]+)>)/gi, "")
      if (text.charAt(text.length - 1) !== " ") text += " "
      slideArr.lines![0].text.push({ value: text, style: template[0]?.lines?.[0].text?.[0].style || "font-size: 80px;" })

      if ((i + 1) % $scriptureSettings.versesPerSlide === 0) {
        let range: any[] = sorted.slice(i - $scriptureSettings.versesPerSlide + 1, i + 1)
        addMeta($scriptureSettings.showVersion, $scriptureSettings.showVerse, joinRange(range))
        if (i + 1 < sorted.length) slides.push([{ lines: [{ text: [], align: template[0]?.lines?.[0].align || "text-align: justify;" }], style: itemStyle }])
      }
    })
    let remainder = sorted.length % $scriptureSettings.versesPerSlide
    let range: any[] = sorted.slice(sorted.length - remainder, sorted.length)
    if (remainder) addMeta($scriptureSettings.showVersion, $scriptureSettings.showVerse, joinRange(range))
  }

  function addMeta(showVersion: boolean, showVerse: boolean, range: string) {
    let lines = []
    let verseStyle = template[1]?.lines?.[0].text?.[0].style || "font-size: 50px;"
    if (showVersion && bible.version) lines.push({ text: [{ value: bible.version, style: verseStyle }], align: "" })
    if (showVerse) lines.push({ text: [{ value: bible.book + " " + bible.chapter + ":" + range, style: verseStyle }], align: "" })
    if ((showVersion && bible.version) || showVerse)
      slides[slides.length - 1].push({
        lines,
        style: template[1]?.style || "top: 910px;left: 50px;width: 1820px;height: 150px;opacity: 0.8;",
      })
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
    let show = new ShowObj(false, "scripture", layoutID, new Date().getTime(), false)
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
    update(id, val)
  }

  let templateList: any[] = []
  $: templateList = Object.entries($templates).map(([id, template]: any) => ({ id, name: template.name }))

  const updateColor = (e: any) => update("numberColor", e.target.value)

  function update(id: string, value: any) {
    scriptureSettings.update((a) => {
      a[id] = value
      return a
    })
  }

  function showVerse() {
    if ($outLocked) return
    let tempItems: Item[] = slides[0] || []
    setOutput("slide", { id: "temp", tempItems })
  }

  // show on enter
  function keydown(e: any) {
    if (e.key === "Enter") showVerse()
  }
</script>

<svelte:window on:keydown={keydown} />

<div class="scroll">
  <Zoomed style="width: 100%;">
    {#if bible.activeVerses}
      <!-- {#each slides as items} -->
      {#each slides[0] as item}
        <Textbox {item} ref={{ id: "scripture" }} />
      {/each}
      <!-- {/each} -->
    {/if}
  </Zoomed>

  <div style="text-align: center;opacity: 0.8;padding: 8px 0;">
    <!-- {bible.version}
    <br /> -->
    {bible.book}
    {bible.chapter}{#if verseRange.length}:{verseRange}{/if}
  </div>

  <!-- TODO: drag&drop slide(s) -->

  <!-- settings: red jw, verse numbers, verse break, max verses per slide, show version, show book&chapter&verse, text formatting -->
  <!-- settings -->
  <div class="settings">
    <span>
      <p><T id="info.template" /></p>
      <Dropdown options={templateList} value={$templates[$scriptureSettings.template]?.name || "—"} on:click={(e) => update("template", e.detail.id)} style="width: 50%;" />
    </span>
    <span>
      <p><T id="scripture.max_verses" /></p>
      <NumberInput value={$scriptureSettings.versesPerSlide} min={1} max={25} on:change={(e) => update("versesPerSlide", e.detail)} buttons={false} />
    </span>
    <span>
      <p><T id="scripture.verse_numbers" /></p>
      <Checkbox id="verseNumbers" checked={$scriptureSettings.verseNumbers} on:change={checked} />
    </span>
    {#if $scriptureSettings.verseNumbers}
      <span>
        <p><T id="edit.color" /></p>
        <Color height={20} width={50} value={$scriptureSettings.numberColor || "#919191"} on:input={updateColor} />
      </span>
    {/if}
    <span>
      <p><T id="scripture.version" /></p>
      <Checkbox id="showVersion" checked={$scriptureSettings.showVersion} on:change={checked} />
    </span>
    <span>
      <p><T id="scripture.reference" /></p>
      <Checkbox id="showVerse" checked={$scriptureSettings.showVerse} on:change={checked} />
    </span>
    <!-- <span>
      <p><T id="scripture.red_jesus" /> (WIP)</p>
      <Checkbox id="redJesus" checked={$scriptureSettings.redJesus} on:change={checked} />
    </span> -->
  </div>
</div>

<Button on:click={createShow} style="width: 100%;" disabled={!verseRange} dark center>
  <Icon id="show" right />
  <T id="new.show" />
  {#if slides.length > 1}
    <span style="opacity: 0.5;margin-left: 0.5em;">({slides.length})</span>
  {/if}
</Button>

<style>
  .scroll {
    display: flex;
    flex-direction: column;
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
  }

  div :global(.zoomed) {
    height: initial !important;
  }

  .settings {
    display: flex;
    flex-direction: column;
    gap: 5px;
    padding: 10px;
    padding-top: 0;
  }
  .settings span {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .settings :global(.dropdown) {
    position: absolute;
    width: 100% !important;
  }

  .settings :global(.numberInput) {
    width: 50px;
  }
</style>
