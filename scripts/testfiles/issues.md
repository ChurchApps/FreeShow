DONE: Handle lyrics with empty lines. Both directly following a [] tag, or within a lyrics text block. Opensong ignores the empty lines and just presents as if it's not there. Freeshow-import creates a new slide after the new line and uses the whole first line after the empty line as slidename. This slide is also not added to the standard layout, since it didn't have an entry in the Opensong tag. (Better would be to split Opensong verses on [] tags only, and not on newlines?)

DONE: Handle songs without any [] tags more gracefully. Opensong leaves the slide ID empty when presenting. Freeshow uses the whole first lyrics line as slidename. Even though the source file is strictly incorrect, more graceful might be to import the slide as "Verse 1". This only concerns the slide name, the slide text is imported correctly.
DONE: Handle multiple of same [] tag definitions. While presenting, Opensong consolidates all text with same [] tags. Freeshow uses the last [] definition, which gives a different result. Even though the source file is strictly incorrect, more graceful would be to consolidate text like Opensong.
ORIGINAL: Handle double [] tag definitions. Opensong uses the first [] definition. Freeshow uses the last [] definition, which gives a different result. Even though the source file is strictly incorrect, more graceful would be to use first definition like Opensong.

DONE: Handle comments (lines starting with ";"). Opensong ignore these lines while presenting. Freeshow-import currently adds the comments as regular lyrics lines. Add the comment lines as slide notes.
ORIGINAL: Handle comments (lines starting with ";"). Opensong ignore these lines while presenting. Freeshow-import currently adds the comments as regular lyrics lines.

DONE: (Already fixed in issue 2696: Handle Opensong blocks with whitespace after a [] tag.)

DONE: Handle Opensong [] tags in lowercase. Opensong handles [V1] and [v1] tags case-insensitive. Freeshow-import uses the globalgroup "Verse 1" tag for [V1]. For [v1] it creates a non-globalgroup "v1" tag.

DONE: Handle Opensong `<presentation>` tags in lowercase. Opensong handles v1 V2 case-insensitive. Freeshow-import doesn't add the verse to the standard layout if case is unmatched. (Note: This only happens when editing the Opensong file manually, Opensong application normally changes the presentation field to uppercase on edit.)
ORIGINAL: Handle Opensong tags in lowercase. Opensong handles v1 V2 case-insensitive. Freeshow-import doesn't add the verse to the standard layout if case is unmatched. (Note: This only happens when editing the Opensong file manually, Opensong application normally changes the presentation field to uppercase on edit.)

============
DONE: Better handle "|" newline character. Opensong adds an empty line in place of the "|" character while presenting the lyrics. Freeshow-import replaces the newline by a non-breaking-space. which is different result and also gives confusing behavior since it is not a regular space). It would be better to add an empty line.

==================
New

DONE: Recognize [P] as Pre-chorus



// extract chord data (lines starting with '.')
            const chordData = lines.filter((_v: string) => _v.trim().startsWith(".")).join("")
            // extract comment lines (starting with ';') for later processing
            const commentData = lines
                .filter((l: string) => l.trim().startsWith(";"))
                .map((l: string) => l.trim().slice(1).trim())
            // text lines: exclude chord lines and comment lines
            const text = lines.filter((_v: string) => !_v.trim().startsWith(".") && !_v.trim().startsWith(";"))

===================
Don't solve in opensong importer:

ORIGINAL: Better numbering of [] tag definitions that are not used in Opensong tag. Freeshow-import numbers the unused verses as "Verse 1", "Verse 2", and the used verses are numbered after that (Verse 3, Verse 4), regardless of Opensong numbering. This only concerns the verse numbering, the used slides are presented correctly and in order.
UPDATED: When not all slides are used in layout, Freeshow numbers the unused verses as "Verse 1", "Verse 2", and the used verses are numbered after that (Verse 3, Verse 4), regardless of original order. When creating a second layout, the verse numbering suddenly is in verse-order, both for original layout and new layout. When deleting the new layout, numbering goes back to "unused verses first".

