import { WmeSDK } from "wme-sdk-typings";
import type * as TurfType from '@turf/turf';
declare const turf: typeof TurfType;

// Declare global Window variables
declare global {
    interface Window {
        ffFormData: any;
    }
}

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

// SDK Bootloader
if ((window as any).SDK_INITIALIZED) {
    (window as any).SDK_INITIALIZED.then(bootstrap).catch((err: any) => {
        console.error(`${SCRIPT_NAME}: SDK initialization failed`, err);
    });
} else {
    console.warn(`${SCRIPT_NAME}: SDK_INITIALIZED is undefined`);
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
            console.log(`${SCRIPT_NAME}: All dependencies are ready.`);
            init();
        });
    } catch (error) {
        console.error(`${SCRIPT_NAME}: Failed to initialize SDK`, error);
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
    console.log(`${SCRIPT_NAME}: Initializing...`);

    try {
        // 1. Register with the SDK to get native Waze tab elements.
        // We cast to 'any' here if the SDK's TypeScript types are lagging behind 
        // the actual return signature of the registration method.
        const { tabLabel, tabPane } = await (wmeSDK.Sidebar as any).registerScriptTab();

        // tabLabel helper 
        applyTabIcon(tabLabel)
        tabLabel.title = 'WME Form Filler';

        /** * 3. Settings Container Creation
         * Building the root element for the script's settings panel.
         */
        const settingsDiv = document.createElement('div');
        settingsDiv.id = 'ff-settings-root';
        settingsDiv.style.padding = '16px';
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

        // 4. Append it to the pane provided by the SDK.
        tabPane.appendChild(settingsDiv);

        console.log(`${SCRIPT_NAME}: Tab fully built and labeled.`);

        /** * Start the main logic (event listeners for selection, etc.)
         * @see {@link main}
         */
        main();

    } catch (error) {
        console.error(`${SCRIPT_NAME}: Error creating script tab`, error);
    }
}

/** * Data container that mimics what your legacy scraper used to collect.
 * You can access this object when it's time to build your Form URL.
 */
interface CapturedData {
    segmentId: number;
    streetId: number | null;
    cityId: number | null;
    stateId: number | null;
    streetName: string;
    isReady: boolean;
}
let capturedFormData = {
    streetName: "",
    cityName: "",
    stateName: "",
    segmentId: "",
    isReady: false
};

let activeForms: any[] = []; // This MUST be top-level (outside main)

const launchForm = (formData: any, prefilledUrl: string) => {
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

function main() {
    console.log(`${SCRIPT_NAME}: Functional Logic Active.`);

    const ffForms = window.ffFormData;

    if (!ffForms) {
        console.error("WME Form Filler: Form data not found. Check @require links.");
        return;
    }

    console.log("WME Form Filler: Data loaded successfully!");

    // 2. Example: Accessing the USA States
    const usaStates = ffForms.COUNTRIES.USA.states;
    
    // 3. Build your UI (Dropdowns, Buttons, etc.)
    Object.keys(usaStates).forEach(stateAbbr => {
        const stateData = usaStates[stateAbbr];
        // Here you would call your function to add these to the WME sidebar
        console.log(`Setting up forms for ${stateAbbr}:`, Object.keys(stateData));
    });

    selectionSubscription = wmeSDK.Events.on({
        eventName: 'wme-selection-changed',
        eventHandler: () => {
            const selection = wmeSDK.Editing.getSelection();

            // 1. Reset state if selection is empty or not a segment
            if (!selection || selection.objectType !== 'segment' || selection.ids.length === 0) {
                capturedFormData.isReady = false;
                console.log(`${SCRIPT_NAME}: Selection cleared.`);
                return;
            }

            // 2. Data Extraction (Replacing the old DOM scraping)
            const segmentId = selection.ids[0];
            const segment = wmeSDK.DataModel.Segments.getById({ segmentId });

            if (segment) {
                // 1. Use 'primaryStreetId' to satisfy the TypeScript compiler
                const streetId = (segment as any).primaryStreetId || segment.primaryStreetId;

                const street = wmeSDK.DataModel.Streets.getById({ streetId });
                const city = street?.cityId
                    ? wmeSDK.DataModel.Cities.getById({ cityId: street.cityId })
                    : null;
                const state = city?.stateId
                    ? wmeSDK.DataModel.States.getById({ stateId: city.stateId })
                    : null;

                capturedFormData = {
                    segmentId: segmentId.toString(),
                    streetName: street?.name || "No Street Name",
                    cityName: city?.name || "No City",
                    stateName: state?.name || "",
                    isReady: true
                };

                console.log(`${SCRIPT_NAME}: Captured Data:`, capturedFormData);

                // 4. (Legacy Hook) 
                // If your legacy code looked for an input box to fill immediately, do it here:
                const legacyInput = document.getElementById('ff-reason') as HTMLInputElement;
                if (legacyInput) {
                    legacyInput.value = `Work on ${capturedFormData.streetName}`;
                }
            }
        },
    });
}