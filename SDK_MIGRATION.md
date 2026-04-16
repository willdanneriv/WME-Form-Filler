# Migration Progress: Form Filler Legacy → WME SDK V2

Document all features/functionality and how it was migrated to the SDK.

---

## Settings
1. **Open form in new tab** (`ffOpenInTab`) - checkbox - Opens the Google form in a new browser tab.
2. **Closures Reason** - (`ffClosureReason`) - text input - Set default closure reason.
3. **Closures End** (`ffClosureEndDate`/`ffClosureEndTime`) - datepicker - Set default closure end date and time.

---

## Feature Migrations

| Feature | Change |
| --- | --- |
| Bootstrap / ready | `if (typeof W.app === "undefined" ... })` → `wmeSDK.Events.On('wme-ready', ... )` |
| Tab registration | `ff_addUserTab()` → `wmeSDK.Sidebar.registerScriptTab()` |
| Settings load/save | `ff_loadSettings()`/`ff_saveSettings()` Retained localStorage, changed to object vs individual settings |
| Imperial Units | `W.prefs.on("change:isImperial", ...)` → `wmeSDK.Events.On('wme-user-settings-changed', ...)` |

## Selection
| Feature | Change |
| --- | --- |
| Get selected segment(s) | `W.selectionManager.getSelectedDataModelObjects()` → `wmeSDK.Editing.getSelection()`|
| Get street (`ff_getStreetName()`) |  `W.model.streets.getObjectById(...)` → `wmeSDK.DataModel.Streets.getStreet(...)` |
| Get city (`ff_getCity`) | `W.model.cities.getObjectById(...)` → `wmeSDK.DataModel.Cities.getCity(...)` |
| Get state (`ff_getState()`) | `W.model.states.getObjectById(...)` → `wmeSDK.DataModel.States.getById(...)` |
| Get country | `W.model.countries.getObjectById(...)` → `wmeSDK.DataModel.Countries.getById(...)` |
| Get county (`ff_getCounty()`) | Disabled in legacy code. Default empty string |
| Has active closure (`ff_closureActive()`)| `W.model.roadClosures.active` → `wmeSDK.DataModel.RoadClosures.getById()` |
| Closure information (`ff_getClosureInfo()`)| `W.model.roadClosures.getObjectArray()` → `wmeSDK.DataModel.RoadClosures.getAll()` |
| Get region code | `W.app.getAppRegionCode()` → `wmeSDK.DataModel.Country.regionCode()` |
| Get zoom level | `W.map.getOLMap().zoom` → `wmeSDK.Map.getZoomLevel()` |
| Get logged in username | `W.loginManager.user.attributes.userName` → `wmeSDK.State.getUserInfo().userName` |
| Get last editor (`ff_getLastEditor`) | `*.selected.model.attributes.updatedBy`/`*.model.attributes.createdBy` → `wmeSDK.Segments.getByID(...).modificationData.*`|

## Geometry Calculations
| Legacy | Turf Replacment |
| --- | --- |
| Get LatLon | `WazeWrap.Geometry.ConvertTo4326(W.map.getOLMap().center.lon, W.map.getOLMap().center.lat)` → `wmeSDK.Map.getCenter()`
| Centered on segment | `selection[0].getCenterLonLat() → turf.center(segment.geometry)`

## Functions removed
`if (W.app.modeController) {...}` function alreay removed from W.