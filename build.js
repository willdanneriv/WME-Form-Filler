const esbuild = require('esbuild');

const metadata = `// ==UserScript==
// @name         WME Form Filler (SDK)
// @namespace    https://greasyfork.org/users/6605
// @version      ${require('./package.json').version}
// @description  Use info from WME to automatically fill out related forms.
// @author       crazycaveman, willdanneriv
// @include      /^https:\\/\\/(www|beta)\\.waze\\.com\\/(?!user\\/)(.{2,6}\\/)?editor.*$/
// @license      MIT
// @grant        none
// @require      https://cdn.jsdelivr.net/npm/@turf/turf@7/turf.min.js  
// @require      https://cdn.jsdelivr.net/gh/willdanneriv/WME-Form-Filler@sdk-migration/forms/forms.js
// @run-at       document-end
// ==/UserScript==\n`;

async function runBuild() {
  const ctx = await esbuild.context({
    entryPoints: ['WME Form Filler.user.ts'],
    bundle: true,
    outfile: 'WME Form Filler.user.js',
    banner: { js: metadata },
    format: 'iife', 
    target: 'es2020',
    logLevel: 'info',
    external: ['@turf/turf']
  });

  if (process.argv.includes('--watch')) {
    console.log('Watching src/ for changes...');
    await ctx.watch();
  } else {
    await ctx.rebuild();
    await ctx.dispose();
  }
}

runBuild().catch(() => process.exit(1));