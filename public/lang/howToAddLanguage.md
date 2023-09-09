# How to add your own language:

1. Go to [FreeShow at Transifex](https://app.transifex.com/nettbiter/freeshow/) and request your language
2. You will get notifications on mail when you can translate

**OR**

1. Download the [en.json](./en.json) file, and translate it
2. Send it to me on mail: [dev@freeshow.app](mailto:dev@freeshow.app)

**OR**

1. [Fork this repository](https://github.com/vassbo/freeshow/fork) to make changes
2. Make sure you have selected the "dev" branch, not the "main" branch
3. Find the language identifier for your country: [https://en.wikipedia.org/wiki/List_of_ISO_639-1_codes](https://en.wikipedia.org/wiki/List_of_ISO_639-1_codes)
4. Create a file in [this directory](.) called "{language_id}.json"
5. Copy the content from [en.json](./en.json) to the new file
6. Translate all the strings! (Just the part inside the "" after the colons)
7. Go to the [languageData.ts](/src/frontend/utils/languageData.ts) file and fill in the missing data
8. Create a [new pull request](https://github.com/vassbo/freeshow/compare) to the "dev" branch

> Thank you :)
