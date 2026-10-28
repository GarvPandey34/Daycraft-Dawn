import test from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveReducedMotion,
  shouldRunAmbientAnimation,
  MOTION_DURATIONS,
  MOTION_SPRINGS,
  MOTION_EASINGS,
} from '../src/theme/motion';
import {
  soundService,
  SOUNDSCAPE_PRESETS,
  AMBIENT_TRACK_LIST,
} from '../src/services/soundService';
import { deviceModeService } from '../src/services/deviceModeService';

test('resolveReducedMotion honors explicit user overrides and system preference', () => {
  // Explicit reduced
  assert.equal(resolveReducedMotion('reduced', false), true);
  assert.equal(resolveReducedMotion('reduced', true), true);

  // Explicit full
  assert.equal(resolveReducedMotion('full', false), false);
  assert.equal(resolveReducedMotion('full', true), false);

  // System fallback
  assert.equal(resolveReducedMotion('system', true), true);
  assert.equal(resolveReducedMotion('system', false), false);
});

test('shouldRunAmbientAnimation pauses decorative motion when reduced or page hidden', () => {
  // Normal visible page + full motion
  assert.equal(shouldRunAmbientAnimation(false, true), true);

  // Reduced motion active -> never run ambient animation
  assert.equal(shouldRunAmbientAnimation(true, true), false);
  assert.equal(shouldRunAmbientAnimation(true, false), false);

  // Page hidden -> never run ambient animation
  assert.equal(shouldRunAmbientAnimation(false, false), false);
});

test('motion durations and springs conform to high-end UI constraints', () => {
  // Micro interactions between 150ms and 350ms
  assert.ok(MOTION_DURATIONS.micro >= 0.15 && MOTION_DURATIONS.micro <= 0.35);
  assert.ok(MOTION_DURATIONS.nav >= 0.15 && MOTION_DURATIONS.nav <= 0.35);
  assert.ok(MOTION_DURATIONS.card >= 0.15 && MOTION_DURATIONS.card <= 0.35);

  // Atmospheric duration longer for calm drift
  assert.ok(MOTION_DURATIONS.atmospheric >= 0.5);

  // Spring settings have positive stiffness and damping
  assert.equal(MOTION_SPRINGS.snappy.type, 'spring');
  assert.ok((MOTION_SPRINGS.snappy as { stiffness: number }).stiffness > 200);
  assert.ok((MOTION_SPRINGS.snappy as { damping: number }).damping > 20);

  // Cubic bezier easing curves valid
  assert.equal(MOTION_EASINGS.easeOut.length, 4);
  assert.equal(MOTION_EASINGS.easeInOut.length, 4);
});

test('soundService provides safe audio analysis data and reactive state in node environment', () => {
  const analysis = soundService.getAudioAnalysisData();
  assert.equal(analysis.isPlaying, false);
  assert.equal(analysis.rms, 0);
  assert.equal(analysis.frequencies.length, 32);

  assert.equal(soundService.isTrackAudible('rain'), false);
  assert.ok(soundService.getMasterVolume() >= 0 && soundService.getMasterVolume() <= 1);

  let notifiedCount = 0;
  const unsubscribe = soundService.subscribe(() => {
    notifiedCount += 1;
  });
  soundService.setMasterVolume(0.75);
  assert.equal(soundService.getMasterVolume(), 0.75);
  assert.equal(notifiedCount, 1);
  unsubscribe();
});

test('deviceModeService.inspectModeSupport and applySessionMode report honest verification status', async () => {
  const vibrateSupport = deviceModeService.inspectModeSupport('vibrate');
  assert.ok(['verified_hardware', 'unsupported_fallback'].includes(vibrateSupport.verification));
  assert.ok(vibrateSupport.badgeLabel.length > 0);

  const dndRes = await deviceModeService.applySessionMode('dnd');
  assert.equal(dndRes.success, true);
  assert.equal(deviceModeService.getCurrentMode(), 'dnd');
  assert.ok(dndRes.appliedScopeLabel.length > 0);
  assert.ok(['verified_hardware', 'in_app_isolated', 'unsupported_fallback'].includes(dndRes.verification));
});

test('ambient presets and track mappings are unique and valid', () => {
  const trackIds = AMBIENT_TRACK_LIST.map(t => t.id);
  const uniqueTrackIds = new Set(trackIds);
  assert.equal(trackIds.length, uniqueTrackIds.size);

  SOUNDSCAPE_PRESETS.forEach(preset => {
    assert.ok(preset.name.length > 0);
    const presetTrackKeys = Object.keys(preset.tracks);
    assert.ok(presetTrackKeys.length > 0);
    presetTrackKeys.forEach(key => {
      assert.ok(uniqueTrackIds.has(key as any), `Unknown track ID: ${key}`);
      const vol = preset.tracks[key as keyof typeof preset.tracks];
      assert.ok(typeof vol === 'number' && vol >= 0 && vol <= 1);
    });
  });
});
