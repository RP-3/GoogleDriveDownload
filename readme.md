## This is a bunch of hacked-together scripts to get our wedding photos off Google Drive
- `index.ts` just generates a list of all photos in Google Drive in the specified folder (recursive)
- That list gets manually saved as `fileList.json`
- `downloadAll.ts` uses `fileList.json` to download all photos to `downloadedData`
    - Typescript freaks out because it thinks on line 38 res.data is not observable
    - That's a lie. Google's types are just wrong. Future me, you can thank me later.
- Both `index.ts` and `downloadAll.ts` need `credentials.json` to exist. I downloaded these off
  Google Drive's `getting started quickstart` interface. The URL keeps changing so there's no
  point saving it here.
- Both scripts contain copy-pasta auth code. That code saves a token to disk called `token.json`
  so don't create anything else with that name.