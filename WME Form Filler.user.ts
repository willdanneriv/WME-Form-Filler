import { WmeSDK } from "wme-sdk-typings";
import type * as TurfType from '@turf/turf';
declare const turf: typeof TurfType;

// Declare global Window variables
declare global {
    interface Window {
        ffFormData: any;
    }
}

// --- Interfaces ---

/** * Data container that mimics what your legacy scraper used to collect.
 * You can access this object when it's time to build your Form URL.
 */
interface CapturedFormData {
    segmentIds: string[];
    streetName: string[];
    cityName: string;
    stateName: string;
    stateAbbr: string;
    isReady: boolean;
}

// --- Global State Variables ---
let activeForms: any[] = []; // This MUST be top-level (outside main)
let activeSelectionIds: (string | number)[] = [];
let capturedFormData: CapturedFormData = {
    segmentIds: [],
    streetName: [],
    cityName: "",
    stateName: "",
    stateAbbr: "",
    isReady: false
};


// These are provided by the WME environment/Tampermonkey
declare const GM_info: any;
declare const getWmeSdk: (config: { scriptId: string, scriptName: string }) => WmeSDK;

// At the top of your file, let's keep track of the listener cleanup
let selectionSubscription: (() => void) | null = null;

/**
 * Optimized SVG Icon for the WME Form Filler.
 * Replaces the legacy Base64 PNG to support high-DPI displays and CSS theming.
 */
const WMEFFIcon = `
<svg width="20" height="20" version="1.1" viewBox="0 0 8.4667 8.4667" xmlns="http://www.w3.org/2000/svg">
 <g transform="translate(-.11456 -.056373)">
  <path d="m0.35681 0.15792v8.2636h6.5428v-2.3492h-0.56431v1.7828h-5.4121v-7.1329h5.4121v3.0324h0.56431v-3.5967z" stop-color="#000000"/>
  <path d="m7.4447 2.9003-2.3461 3.67c0.00955 0.51942-0.62701 1.7224 0.73446 0.60612l2.2202-3.7313z" stop-color="#000000" stroke-width=".8629"/>
  <path d="m7.6205 2.6399 0.62634 0.53019" stroke="#000" stroke-width=".2853px"/>
  <path d="m3.3035 7.0789a0.19926 0.15731 0 0 1-0.19926 0.15731 0.19926 0.15731 0 0 1-0.19926-0.15731 0.19926 0.15731 0 0 1 0.19926-0.15731 0.19926 0.15731 0 0 1 0.19926 0.15731zm-1.3319 0.020975a0.19926 0.15731 0 0 1-0.19926 0.15731 0.19926 0.15731 0 0 1-0.19926-0.15731 0.19926 0.15731 0 0 1 0.19926-0.15731 0.19926 0.15731 0 0 1 0.19926 0.15731zm-0.48026-2.148 4.2535-0.024672m-4.264-1.8526 4.2535-0.024672m-4.2507 2.8249 3.1677-0.025016m-3.1467-1.9151 3.1677-0.025016m-3.1677-1.8417 3.1677-0.025016" stroke="#000" stroke-width=".565"/>
 </g>
</svg>`

const SCRIPT_NAME = GM_info.script.name;
let wmeSDK: WmeSDK;

/**
 * Logs messages to the console with FormFiller prefix.
 * @param {any} message - The text to log.
 * @param {string} [level='log'] - The log level (log, warn, error)
 * @param {object} [data] - Optional data to include.
 * @since v.2026.04.15 (SDK Migration)
 */
function formfiller_log(message: any, level: 'log' | 'warn' | 'error' | 'info' = 'log', data: any = null) {
    const msgPrefix = "[FormFiller]";

    if (data) console[level](msgPrefix, message, data)
    else console[level](msgPrefix, message)
}


// SDK Bootloader
if ((window as any).SDK_INITIALIZED) {
    (window as any).SDK_INITIALIZED.then(bootstrap).catch((err: any) => {
        formfiller_log(`${SCRIPT_NAME}: SDK initialization failed`, "error", err);
    });
} else {
    formfiller_log(`${SCRIPT_NAME}: SDK_INITIALIZED is undefined`, "warn");
}

/**
 * Main entry point for the script. Initializes the WME SDK and waits for 
 * the environment to be fully loaded before starting core functionality.
 * @async
 * @throws {Error} If the SDK fails to initialize with the provided script metadata.
 */
function bootstrap(): void {
    try {
        wmeSDK = getWmeSdk({
            scriptId: SCRIPT_NAME.replaceAll(' ', ''),
            scriptName: SCRIPT_NAME,
        });

        wmeReady().then(() => {
            formfiller_log(`${SCRIPT_NAME}: All dependencies are ready.`, "info");
            init();
        });
    } catch (error) {
        formfiller_log(`${SCRIPT_NAME}: Failed to initialize SDK`, "error", error);
    }
}

/**
 * Ensures the WME environment is ready for data interaction.
 * Checks the current SDK state and waits for the 'wme-ready' event if necessary.
 * @returns {Promise<void>} Resolves when WME is fully interactive.
 */
function wmeReady(): Promise<void> {
    return new Promise((resolve) => {
        if (wmeSDK.State.isReady()) {
            resolve();
        } else {
            // Using the SDK's internal event system to wait for the platform
            wmeSDK.Events.once({ eventName: 'wme-ready' }).then(() => resolve());
        }
    });
}

/**
 * Injects the script icon into the SDK-provided sidebar tab.
 * Uses the SVG constant to ensure sharpness across all zoom levels.
 * @param {HTMLElement} labelElement - The tabLabel returned by registerScriptTab.
 */
function applyTabIcon(labelElement: HTMLElement): void {
    const tabButton = labelElement.closest('button');
    if (tabButton) {
        // Kill the white box/pill
        tabButton.style.setProperty('background', 'transparent', 'important');
        tabButton.style.setProperty('border', 'none', 'important');
        tabButton.style.setProperty('box-shadow', 'none', 'important');

        // Ensure the button itself allows centering
        tabButton.style.display = 'flex';
        tabButton.style.alignItems = 'center';
        tabButton.style.justifyContent = 'center';
    }

    // Centering Logic
    Object.assign(labelElement.style, {
        display: 'flex',
        alignItems: 'center',     // Vertical centering
        justifyContent: 'center',    // Horizontal centering
        height: '100%',            // Fill the button height
        width: '100%',
        margin: '0',
        padding: '0'
    });

    labelElement.innerHTML = WMEFFIcon;
    labelElement.style.color = '#606060';
}

/**
 * Initializes the script's visual and functional components.
 * This function utilizes the WME SDK to generate tab containers and then
 * injects custom HTML elements for settings and controls.
 * @async
 * @returns {Promise<void>}
 * @throws {Error} If the SDK sidebar registration fails.
 */
async function init(): Promise<void> {
    formfiller_log(`${SCRIPT_NAME}: Initializing...`, "info");

    try {
        // 1. Register with the SDK to get native Waze tab elements.
        // We cast to 'any' here if the SDK's TypeScript types are lagging behind 
        // the actual return signature of the registration method.
        const { tabLabel, tabPane } = await (wmeSDK.Sidebar as any).registerScriptTab();

        // tabLabel helper 
        applyTabIcon(tabLabel)
        tabLabel.title = 'WME Form Filler';

        // Header Container Creation
        const headerDiv = document.createElement('div');
        headerDiv.id = 'ff-header';
        headerDiv.style.padding = '16px';
        headerDiv.innerHTML = `
            <h4 style="font-weight: bold; border-bottom: 1px solid #ccc; padding-bottom: 8px; color: black;">
                Form Filler
            </h4>
        `;
        // Append header to pane.
        tabPane.appendChild(headerDiv);

        // Settings Section Creation
        const settingsSection = document.createElement('div');
        settingsSection.id = 'ff-settings-section';
        settingsSection.innerHTML = `
            <h4 style="margin-bottom:10px;">Settings</h4>
            <div style="margin-top: 15px; margin-right: 5px">
                <label style="display: block; font-size: 12px; color: #666;" > Closure Reason </label>
                <input type = "text" id = "ff-reason" placeholder = "Construction" style = "width: 100%; border: 1px solid #ccc; padding: 8px; color: #000; background: white;"
            </div>`
        settingsSection.style.paddingBottom = '15px';
        settingsSection.style.borderBottom = '1px solid #ccc';
        tabPane.appendChild(settingsSection);

        // 2. Forms Section Creation
        const formsSection = document.createElement('div');
        formsSection.id = 'ff-forms-section';
        formsSection.innerHTML = '<h4 style="margin-top:15px;">Available Forms</h4>';
        tabPane.appendChild(formsSection);

        formfiller_log(`${SCRIPT_NAME}: Tab fully built and labeled.`, "info");

        /** * Start the main logic (event listeners for selection, etc.)
         * @see {@link main}
         */
        main();

    } catch (error) {
        formfiller_log(`${SCRIPT_NAME}: Error creating script tab`, "error", error);
    }
}

const launchForm = (formData: any, prefilledUrl: string) => {
    //FIXME
    const mode = ffUserSettings.displayMode; // 'sidebar' | 'tab' | 'window'

    switch (mode) {
        case 'sidebar':
            // Inject iframe into your custom WME Sidebar tab
            const container = document.getElementById('wme-form-filler-tab');
            if (container) {
                container.innerHTML = `<iframe src="${prefilledUrl}&embedded=true" style="width:100%; height:100vh; border:none;"></iframe>`;
            }
            break;

        case 'tab':
            // The classic "New Tab" behavior
            window.open(prefilledUrl, '_blank');
            break;

        case 'window':
            // A dedicated popup window (cleaner than a full tab)
            const width = 600, height = 800;
            const left = (screen.width / 2) - (width / 2);
            const top = (screen.height / 2) - (height / 2);
            window.open(prefilledUrl, 'FormFiller', `width=${width},height=${height},top=${top},left=${left}`);
            break;
    }
};

/**
 * Converts state names to abbreviations and vice versa using ffFormData.
 * @param {string} input - The state name or abbreviation to convert.
 * @param {'abbr' | 'name'} to - The target format.
 */
function abbrState(input: string, to: 'abbr' | 'name'): string | undefined {
    const statesData = window.ffFormData?.COUNTRIES?.USA?.STATES;
    if (!statesData) {
        formfiller_log("State data not found in ffFormData", "error");
        return undefined;
    }

    const cleanInput = input.toUpperCase().trim();

    if (to === 'abbr') {
        // Find the KEY where the .name matches the input.
        return Object.keys(statesData).find(
            key => statesData[key].name?.toUpperCase() === cleanInput
        );
    } else {
        // Direct lookup: return the .name property for the given key (e.g., statesData["IL"].name)
        return statesData[cleanInput]?.name;
    }
}

/**
 * Gathers all forms available for a specific state.
 * @param {string} stateAbbr - e.g., "IL" or "VA"
 */
function getFormsForState(stateAbbr: string) {
    const stateData = window.ffFormData?.COUNTRIES?.USA?.STATES[stateAbbr];

    if (!stateData) return [];

    // Filter out the 'name' property so we only get the Form Objects
    const formKeys = Object.keys(stateData).filter(key => key !== 'name');

    return formKeys.map(key => {
        return {
            id: key, // e.g., "IL_Closures"
            ...stateData[key] // The actual form data (url, fields, etc.)
        };
    });
}

/**
 * Gathers all form keys available for the current location.
 */
function getAvailableFormKeys(countryCode: string, stateAbbr: string): string[] {
    const countryData = window.ffFormData?.COUNTRIES?.[countryCode];
    if (!countryData) return [];

    const keys: string[] = [];

    // 1. Get National Keys (e.g., JANE_TTS, VEOC_Closures)
    Object.keys(countryData).forEach(key => {
        if (key !== 'STATES') keys.push(key);
    });

    // 2. Get State Specific Keys (e.g., VA_Closures)
    const stateData = countryData.STATES?.[stateAbbr];
    if (stateData) {
        Object.keys(stateData).forEach(key => {
            if (key !== 'name') keys.push(key);
        });
    }

    return keys;
}


function main() {
    formfiller_log(`${SCRIPT_NAME}: Functional Logic Active.`, "info");

    const ffForms = (window as any).ffFormData;

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

    // 1. Single, Guarded Loop for UI setup
    Object.keys(usaStates).forEach((stateAbbr) => {
        const stateData = usaStates[stateAbbr];

        if (stateData && typeof stateData === 'object') {
            const formKeys = Object.keys(stateData).filter(key => key !== 'name');
            
            // Reference the container we made in init()
            const container = document.getElementById('ff-forms-section');

            formKeys.forEach(formKey => {
                const btn = document.createElement('button');
                btn.innerText = `${stateAbbr}: ${formKey.replace('_', ' ')}`;
                
                // Styling to fit the WME vibe
                Object.assign(btn.style, {
                    width: '100%',
                    margin: '5px 0',
                    padding: '8px',
                    backgroundColor: '#62ad00',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontWeight: 'bold'
                });

                btn.onclick = () => {
                    if (!capturedFormData.isReady) {
                        alert("Please select segments on the map first!");
                        return;
                    }
                    formfiller_log(`Launching ${formKey} for ${stateAbbr}. Segments: ${capturedFormData.segmentIds.length}`);
                    // Next step: buildUrl(stateData[formKey], capturedFormData);
                };

                container?.appendChild(btn);
            });
            
            formfiller_log(`Setting up forms for ${stateAbbr}:`, "info", formKeys);
        } else {
            formfiller_log(`WME Form Filler: ${stateAbbr} has no valid form data.`, "warn");
        }
    });

    // Selection Event Listener (SDK)
    selectionSubscription = wmeSDK.Events.on({
        eventName: 'wme-selection-changed',
        eventHandler: () => {
            const selection = wmeSDK.Editing.getSelection();

            if (!selection || selection.objectType !== 'segment' || selection.ids.length === 0) {
                activeSelectionIds = [];
                capturedFormData.isReady = false;
                return;
            }

            activeSelectionIds = selection.ids;
            const uniqueStreets = new Set<string>();
            let primaryState = "";

            selection.ids.forEach(id => {
                const seg = wmeSDK.DataModel.Segments.getById({ segmentId: id });
                if (seg) {
                    const streetId = (seg as any).primaryStreetId;
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
                segmentIds: selection.ids.map(id => id.toString()),
                streetName: Array.from(uniqueStreets),
                cityName: "",
                stateName: primaryState,
                stateAbbr: abbrState(primaryState, 'abbr') || "",
                isReady: true
            };

            formfiller_log(`Ready with ${activeSelectionIds.length} segments.`, "info");
        }
    });
}