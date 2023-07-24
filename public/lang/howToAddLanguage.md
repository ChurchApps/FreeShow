# How to add a new language:

1. [Fork this repository](https://github.com/vassbo/freeshow/fork) to make changes
2. Make sure you have selected the "dev" branch, not the "main" branch
3. Find the language identifier for your country: [https://en.wikipedia.org/wiki/List_of_ISO_639-1_codes](https://en.wikipedia.org/wiki/List_of_ISO_639-1_codes)
4. Create a file in [this directory](.) called "{language_id}.json"
5. Copy the content from [en.json](./en.json) to the new file
6. Translate all the strings! (Just the part inside the "" after the colons)
7. Go to the [languageData.ts](/src/frontend/utils/languageData.ts) file and fill in the missing data
8. Create a [new pull request](https://github.com/vassbo/freeshow/compare) to the "dev" branch

> Thank you :)
