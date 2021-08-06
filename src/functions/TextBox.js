// create array to store by html tags
export function getArray(textbox, s, update) {
  let arr = [];
  let found = false;
  let index = 0;
  let first = false;
  [...textbox.children].forEach(child => {
    let text = child.innerText;
    if (text.length) {
      let style = convertStyle(child.getAttribute('style'));
      if (s?.node[0] === child || s?.node[1] === child) found = true;
      if (found && index < s.selectedText.length) {
        let offset = 0;
        if (!first) {
          if (s.node[0] === s.node[1]) offset = Math.min(s.selectionOffset[0], s.selectionOffset[1]);
          else if (s.node[0] === child) offset = s.selectionOffset[0];
          else if (s.node[1] === child) offset = s.selectionOffset[1];
        }
        first = true;
        let end = Math.min(text.length, offset + (s.selectedText.length - index));

        let sliced = text.slice(offset, end);
        index += sliced.length;

        if (offset > 0) arr.push({content: text.slice(0, offset), tag: child.tagName.toLowerCase(), style});
        arr.push({content: sliced, tag: 'span', style: {...style, [update.key]: update.value}});
        if (end < text.length) arr.push({content: text.slice(end, text.length), tag: child.tagName.toLowerCase(), style});
        // console.log('CONTENT:', sliced);
        // console.log(text, [...arr]);
        // console.log(s.selectionOffset);
        // console.log(s.selectedText, offset, end, found);
      } else arr.push({content: text, tag: child.tagName.toLowerCase(), style});
      // if (style === "") console.log('STYLE::::', child);
    }
  })
  return combine(arr);
}

// combine duplicated to take up less space
export function combine(a) {
  for (let i = 0; i < a.length; i++) {
    if (a[i + 1]) {
      let d1 = [], d2 = [];
      let sameStyles = false;
      if (a[i].style) Object.keys(a[i].style).map(key => d1.push(key, a[i].style[key]));
      if (a[i + 1].style) Object.keys(a[i + 1].style).map(key => d2.push(key, a[i + 1].style[key]));
      if (d1.length === d2.length) {
        d1.sort(); d2.sort();
        sameStyles = d1.every((val, j) => val === d2[j]);
      }

      if (sameStyles && a[i].tag === a[i + 1].tag) {
        a[i].content += a[i + 1].content;
        a.splice(i + 1, 1);
        i--;
      }
    }
  }
  return a;
}

// convert css inline style to react object style
export function convertStyle(style) {
  if (!style?.length) style = null;
  if (style !== null) {
    // style = style.replace(/([a-z])([A-Z])/, '$1-\L$2');
    style = style.replace(/-[a-z]/g, match => match.toUpperCase());
    style = style.replaceAll('-', '');
    style = style.split('; ');
    let obj = {};
    style.forEach(s => obj[s.split(': ')[0]] = s.replaceAll(';', '').split(': ')[1]);
    style = obj;
    // console.log(style);
  }
  return style;
}