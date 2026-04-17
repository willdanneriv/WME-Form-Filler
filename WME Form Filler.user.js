// ==UserScript==
// @name         WME Form Filler (SDK)
// @description  Use info from WME to automatically fill out related forms.
// @namespace    https://greasyfork.org/users/6605
// @version      2026.04.15.01
// @description  Use info from WME to automatically fill out related forms.
// @author       crazycaveman, willdanneriv
// @include      /^https:\/\/(www|beta)\.waze\.com\/(?!user\/)(.{2,6}\/)?editor.*$/
// @license      MIT
// @grant        none
// @require      https://cdn.jsdelivr.net/npm/@turf/turf@7/turf.min.js  
// @require      https://cdn.jsdelivr.net/gh/willdanneriv/WME-Form-Filler@sdk-migration/forms/forms.js
// @run-at       document-end
// ==/UserScript==

"use strict";
(() => {
  // WME Form Filler.user.ts
  var activeSelectionIds = [];
  var capturedFormData = {
    segmentIds: [],
    streetName: [],
    cityName: "",
    stateName: "",
    stateAbbr: "",
    isReady: false
  };
  var selectionSubscription = null;
  var WMEFFIcon = `
<svg width="20" height="20" version="1.1" viewBox="0 0 8.4667 8.4667" xmlns="http://www.w3.org/2000/svg">
 <g transform="translate(-.11456 -.056373)">
  <path d="m0.35681 0.15792v8.2636h6.5428v-2.3492h-0.56431v1.7828h-5.4121v-7.1329h5.4121v3.0324h0.56431v-3.5967z" stop-color="#000000"/>
  <path d="m7.4447 2.9003-2.3461 3.67c0.00955 0.51942-0.62701 1.7224 0.73446 0.60612l2.2202-3.7313z" stop-color="#000000" stroke-width=".8629"/>
  <path d="m7.6205 2.6399 0.62634 0.53019" stroke="#000" stroke-width=".2853px"/>
  <path d="m3.3035 7.0789a0.19926 0.15731 0 0 1-0.19926 0.15731 0.19926 0.15731 0 0 1-0.19926-0.15731 0.19926 0.15731 0 0 1 0.19926-0.15731 0.19926 0.15731 0 0 1 0.19926 0.15731zm-1.3319 0.020975a0.19926 0.15731 0 0 1-0.19926 0.15731 0.19926 0.15731 0 0 1-0.19926-0.15731 0.19926 0.15731 0 0 1 0.19926-0.15731 0.19926 0.15731 0 0 1 0.19926 0.15731zm-0.48026-2.148 4.2535-0.024672m-4.264-1.8526 4.2535-0.024672m-4.2507 2.8249 3.1677-0.025016m-3.1467-1.9151 3.1677-0.025016m-3.1677-1.8417 3.1677-0.025016" stroke="#000" stroke-width=".565"/>
 </g>
</svg>`;
  var SCRIPT_NAME = GM_info.script.name;
  var wmeSDK;
  function formfiller_log(message, level = "log", data = null) {
    const msgPrefix = "[FormFiller]";
    if (data) console[level](msgPrefix, message, data);
    else console[level](msgPrefix, message);
  }
  if (window.SDK_INITIALIZED) {
    window.SDK_INITIALIZED.then(bootstrap).catch((err) => {
      formfiller_log(`${SCRIPT_NAME}: SDK initialization failed`, "error", err);
    });
  } else {
    formfiller_log(`${SCRIPT_NAME}: SDK_INITIALIZED is undefined`, "warn");
  }
  function bootstrap() {
    try {
      wmeSDK = getWmeSdk({
        scriptId: SCRIPT_NAME.replaceAll(" ", ""),
        scriptName: SCRIPT_NAME
      });
      wmeReady().then(() => {
        formfiller_log(`${SCRIPT_NAME}: All dependencies are ready.`, "info");
        init();
      });
    } catch (error) {
      formfiller_log(`${SCRIPT_NAME}: Failed to initialize SDK`, "error", error);
    }
  }
  function wmeReady() {
    return new Promise((resolve) => {
      if (wmeSDK.State.isReady()) {
        resolve();
      } else {
        wmeSDK.Events.once({ eventName: "wme-ready" }).then(() => resolve());
      }
    });
  }
  function applyTabIcon(labelElement) {
    const tabButton = labelElement.closest("button");
    if (tabButton) {
      tabButton.style.setProperty("background", "transparent", "important");
      tabButton.style.setProperty("border", "none", "important");
      tabButton.style.setProperty("box-shadow", "none", "important");
      tabButton.style.display = "flex";
      tabButton.style.alignItems = "center";
      tabButton.style.justifyContent = "center";
    }
    Object.assign(labelElement.style, {
      display: "flex",
      alignItems: "center",
      // Vertical centering
      justifyContent: "center",
      // Horizontal centering
      height: "100%",
      // Fill the button height
      width: "100%",
      margin: "0",
      padding: "0"
    });
    labelElement.innerHTML = WMEFFIcon;
    labelElement.style.color = "#606060";
  }
  async function init() {
    formfiller_log(`${SCRIPT_NAME}: Initializing...`, "info");
    try {
      const { tabLabel, tabPane } = await wmeSDK.Sidebar.registerScriptTab();
      applyTabIcon(tabLabel);
      tabLabel.title = "WME Form Filler";
      const settingsDiv = document.createElement("div");
      settingsDiv.id = "ff-settings-root";
      settingsDiv.style.padding = "16px";
      settingsDiv.innerHTML = `
            <h4 style="font-weight: bold; border-bottom: 1px solid #ccc; padding-bottom: 8px; color: black;">
                Form Filler Settings
            </h4>
            <div style="margin-top: 15px;">
                <label style="display: block; font-size: 12px; color: #666;">Closure Reason</label>
                <input type="text" id="ff-reason" placeholder="Construction"
                       style="width: 100%; border: 1px solid #ccc; padding: 8px; color: #000; background: white;">
            </div>
        `;
      tabPane.appendChild(settingsDiv);
      formfiller_log(`${SCRIPT_NAME}: Tab fully built and labeled.`, "info");
      main();
    } catch (error) {
      formfiller_log(`${SCRIPT_NAME}: Error creating script tab`, "error", error);
    }
  }
  function abbrState(input, to) {
    const statesData = window.ffFormData?.COUNTRIES?.USA?.STATES;
    if (!statesData) {
      formfiller_log("State data not found in ffFormData", "error");
      return void 0;
    }
    const cleanInput = input.toUpperCase().trim();
    if (to === "abbr") {
      return Object.keys(statesData).find(
        (key) => statesData[key].name?.toUpperCase() === cleanInput
      );
    } else {
      return statesData[cleanInput]?.name;
    }
  }
  function main() {
    formfiller_log(`${SCRIPT_NAME}: Functional Logic Active.`, "info");
    const ffForms = window.ffFormData;
    if (!ffForms) {
      formfiller_log(`WME Form Filler: window.ffFormData is missing`, "error");
      return;
    }
    formfiller_log("WME Form Filler: Data loaded successfully!", "info");
    const usaStates = ffForms?.COUNTRIES?.USA?.STATES;
    if (!usaStates) {
      formfiller_log(`WME Form Filler: Path COUNTRIES.USA.STATES not found. Check casing in forms.js.`, "error");
      formfiller_log("Current Data Structure:", "info", ffForms);
      return;
    }
    Object.keys(usaStates).forEach((stateAbbr) => {
      const stateData = usaStates[stateAbbr];
      if (stateData && typeof stateData === "object") {
        const keys = Object.keys(stateData);
        formfiller_log(`Setting up forms for ${stateAbbr}:`, "info", keys);
      } else {
        formfiller_log(`WME Form Filler: ${stateAbbr} has no valid form data.`, "warn");
      }
    });
    selectionSubscription = wmeSDK.Events.on({
      eventName: "wme-selection-changed",
      eventHandler: () => {
        const selection = wmeSDK.Editing.getSelection();
        if (!selection || selection.objectType !== "segment" || selection.ids.length === 0) {
          activeSelectionIds = [];
          capturedFormData.isReady = false;
          return;
        }
        activeSelectionIds = selection.ids;
        const uniqueStreets = /* @__PURE__ */ new Set();
        let primaryState = "";
        selection.ids.forEach((id) => {
          const seg = wmeSDK.DataModel.Segments.getById({ segmentId: id });
          if (seg) {
            const streetId = seg.primaryStreetId;
            const street = wmeSDK.DataModel.Streets.getById({ streetId });
            if (street?.name) uniqueStreets.add(street.name);
            let city = null;
            if (street?.cityId != null) {
              city = wmeSDK.DataModel.Cities.getById({ cityId: street.cityId });
            }
            let state = null;
            if (city?.stateId != null) {
              state = wmeSDK.DataModel.States.getById({ stateId: city.stateId });
            }
            if (state?.name && !primaryState) {
              primaryState = state.name;
            }
          }
        });
        capturedFormData = {
          segmentIds: selection.ids.map((id) => id.toString()),
          streetName: Array.from(uniqueStreets),
          cityName: "",
          stateName: primaryState,
          stateAbbr: abbrState(primaryState, "abbr") || "",
          isReady: true
        };
        formfiller_log(`Ready with ${activeSelectionIds.length} segments.`, "info");
      }
    });
  }
})();
