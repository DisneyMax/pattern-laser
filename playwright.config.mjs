import {defineConfig} from '@playwright/test';
const origin=`http://127.0.0.1:${process.env.PLAYWRIGHT_PORT||4173}`;
export default defineConfig({
 testDir:'./tests/ui',
 fullyParallel:true,
 forbidOnly:!!process.env.CI,
 retries:process.env.CI?1:0,
 failOnFlakyTests:!!process.env.CI,
 workers:2,
 timeout:45_000,
 expect:{timeout:10_000},
 reporter:[['list'],['html',{open:'never'}]],
 use:{
  baseURL:origin+'/pattern-laser/',
  viewport:{width:1440,height:1100},
  trace:'retain-on-failure',
  screenshot:'only-on-failure',
  launchOptions:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}:{},
 },
 projects:[{name:'chromium',use:{browserName:'chromium'}}],
 webServer:{command:'node tests/ui/server.mjs',url:origin+'/pattern-laser/',reuseExistingServer:false,timeout:15_000},
});
