<script lang="ts">
  export let item: any;
  export let textElem: any;

  // chords getting wrong position if not waiting
  const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));
  async function getChordPosition(chord: any, line: number) {
    await delay(10);

    if (!textElem || !textElem.children[line]) return "display: none;";
    let lineElems = [...textElem.children[line].children];
    if (!lineElems?.length) return "display: none;";

    let totalLineWidth = lineElems.reduce(
      (value, elem) => (value += elem.offsetWidth),
      0
    );

    let lineLetters = item.lines![line].text?.reduce(
      (value: number, text: any) => (value += text.value.length),
      0
    );
    if (!lineLetters) return "display: none;";
    let charWidth = totalLineWidth / lineLetters;

    return `left: ${lineElems[0].offsetLeft + chord.pos * charWidth}px;top: ${
      lineElems[0].offsetTop
    }px;`;
  }
</script>

<div class="chords">
  {#each item.lines as line, i}
    {#if line.chords}
      {#each line.chords as chord}
        {#await getChordPosition(chord, i) then pos}
          <div class="context #chord chord" style={pos}>
            <div style="padding: 0 15px;">{chord.key}</div>
          </div>
        {/await}
      {/each}
    {/if}
  {/each}
</div>

<style>
  .chords {
    position: absolute;
    top: 0;
    left: 0;
  }
  .chords :global(.chord) {
    position: absolute;
    transform: translateY(-50%);
    z-index: 3;

    font-size: 2em;
    font-weight: bold;
    color: white;
  }
</style>
