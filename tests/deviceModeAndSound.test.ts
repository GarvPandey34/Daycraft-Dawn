import test from 'node:test';
import assert from 'node:assert/strict';
import { deviceModeService } from '../src/services/deviceModeService';
import { AMBIENT_TRACK_LIST, SOUNDSCAPE_PRESETS } from '../src/services/soundService';

test('AMBIENT_TRACK_LIST defines all 9 authentic ambient tracks with unique IDs and categories', () => {
  assert.equal(AMBIENT_TRACK_LIST.length, 9);
  const ids = AMBIENT_TRACK_LIST.map(t => t.id);
  const expected = [
    'rain',
    'thunder',
    'campfire',
    'forest_wind',
    'ocean_waves',
    'white_noise',
    'brown_noise',
    'cafe_murmur',
    'crickets',
  ];
  for (const exp of expected) {
    assert.ok(ids.includes(exp as any), `Missing track: ${exp}`);
  }
});

test('SOUNDSCAPE_PRESETS align precisely with sound design specifications', () => {
  // 1. Rainy Cabin: Gentle Rain primary, subtle Forest Breeze, NO thunder by default
  const rainyCabin = SOUNDSCAPE_PRESETS.find(p => p.id === 'rainy_cabin');
  assert.ok(rainyCabin, 'rainy_cabin preset exists');
  assert.ok(rainyCabin.tracks.rain && rainyCabin.tracks.rain >= 0.6, 'Rain is primary in Rainy Cabin');
  assert.equal(rainyCabin.tracks.thunder, undefined, 'Rainy Cabin must NOT include thunder by default');

  // 2. Stormy Coast: Ocean Waves main, distant thunder, restrained wind
  const stormyCoast = SOUNDSCAPE_PRESETS.find(p => p.id === 'stormy_coast');
  assert.ok(stormyCoast, 'stormy_coast preset exists');
  assert.ok(stormyCoast.tracks.ocean_waves && stormyCoast.tracks.ocean_waves >= 0.6);
  assert.ok(stormyCoast.tracks.thunder !== undefined);

  // 3. Cozy Coffeehouse: Cozy Café main, subtle Brownian Drone
  const coffeehouse = SOUNDSCAPE_PRESETS.find(p => p.id === 'cozy_coffeehouse');
  assert.ok(coffeehouse, 'cozy_coffeehouse preset exists');
  assert.ok(coffeehouse.tracks.cafe_murmur && coffeehouse.tracks.cafe_murmur >= 0.5);
  assert.ok(coffeehouse.tracks.brown_noise !== undefined);

  // 4. Deep Void: Brownian Drone main, low-level white noise
  const deepVoid = SOUNDSCAPE_PRESETS.find(p => p.id === 'deep_void');
  assert.ok(deepVoid, 'deep_void preset exists');
  assert.ok(deepVoid.tracks.brown_noise && deepVoid.tracks.brown_noise >= 0.6);
  assert.ok(deepVoid.tracks.white_noise !== undefined);

  // 5. Twilight Camp: Crackling Hearth main, Forest Breeze, Night Crickets
  const twilightCamp = SOUNDSCAPE_PRESETS.find(p => p.id === 'twilight_camp');
  assert.ok(twilightCamp, 'twilight_camp preset exists');
  assert.ok(twilightCamp.tracks.campfire && twilightCamp.tracks.campfire >= 0.5);
  assert.ok(twilightCamp.tracks.forest_wind !== undefined);
  assert.ok(twilightCamp.tracks.crickets !== undefined);
});

test('deviceModeService manages session modes and restores previous state', async () => {
  // Reset initial state
  await deviceModeService.restorePreviousMode(false);

  const caps = deviceModeService.getPlatformCapabilities();
  assert.ok(['android', 'windows', 'web'].includes(caps.platform));

  // Apply silent mode
  const res = await deviceModeService.applySessionMode('silent');
  assert.equal(res.success, true);
  assert.equal(deviceModeService.getCurrentMode(), 'silent');
  assert.equal(deviceModeService.isFocusSessionActive(), true);

  // Restore previous mode
  const restoreRes = await deviceModeService.restorePreviousMode(true);
  assert.equal(restoreRes.restored, true);
  assert.equal(deviceModeService.getCurrentMode(), 'sound');
  assert.equal(deviceModeService.isFocusSessionActive(), false);
});

test('deviceModeService preserves manual user overrides during active session', async () => {
  await deviceModeService.restorePreviousMode(false);

  await deviceModeService.applySessionMode('silent');
  assert.equal(deviceModeService.getCurrentMode(), 'silent');

  // User explicitly overrides to dnd during session
  deviceModeService.overrideModeDuringSession('dnd');
  assert.equal(deviceModeService.getCurrentMode(), 'dnd');

  // Restore should honor manual override and not revert blindly
  const restoreRes = await deviceModeService.restorePreviousMode(true);
  assert.equal(restoreRes.restored, false);
  assert.equal(deviceModeService.getCurrentMode(), 'dnd');
});
