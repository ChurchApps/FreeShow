import type { Item, Line } from "../../../types/Show"

export class EditboxHelper {

  static determineCaretLine(item:Item, newLines: Line[]) {
    const oldTexts:string[] = [];
    const newTexts:string[] = [];

    item.lines?.forEach((line) => {
      oldTexts.push(line.text[0].value);
    });

    newLines.forEach((line) => {
      newTexts.push(line.text[0].value);
    });

    let lastLineChanged = -1;
    for (let i=0; i<newTexts.length; i++) {
      const nt = newTexts[i];
      const index = oldTexts.indexOf(nt);
      if (index === -1) lastLineChanged = i;
      else oldTexts.splice(index, 1);
    }
    return lastLineChanged;
  }


}