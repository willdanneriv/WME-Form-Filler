# ⚠️ WORK IN PROGRESS: SDK MIGRATION
**Status:** Architecture overhaul. **DO NOT MERGE**

# WME Form Filler

This script uses information the WME DataModel to automatically fill out related forms for submission. 

## Forms

The following forms are currently supported:

1. `AUS VEOC closures`
2. `US Jane TTS Pronunciation`
3. `USA VEOC closures`
4. `IL closures`
5. `OK closures`
6. `VA Closures`
7. `WI closures`
8. `WV Closures`

## Project Structure

`docs/` - Documentation to support the script.

`forms/` - JSON form files. 

`legacy/` - Original source files preserved for historical reference during the SDK migration.

`WME Form Filler.user.ts` - Modern source code (TypeScript).

`WME Form Filler.user.js` - Compiled distribution (ESBuild output).

`build.js` - Build configuration utilizing esbuild for IIFE bundling and banner injection.

`README.md` - Script Overview. (This file)

`SDK_MIGRATION.md` - Migration from W object to WME SDK.
