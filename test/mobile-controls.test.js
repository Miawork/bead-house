'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { isTouchUi, screenRelativeMove } = require('../src/mobile-controls');

test('uses the stable mobile camera only for touch-sized screens', () => {
  assert.equal(isTouchUi({ innerWidth: 390, navigator: { maxTouchPoints: 5 }, matchMedia: () => ({ matches: true }) }), true);
  assert.equal(isTouchUi({ innerWidth: 1440, navigator: { maxTouchPoints: 5 }, matchMedia: () => ({ matches: true }) }), false);
  assert.equal(isTouchUi({ innerWidth: 820, navigator: { maxTouchPoints: 0 }, matchMedia: () => ({ matches: false }) }), false);
});

test('joystick directions always follow the visible screen axes', () => {
  // Camera faces +Z, so screen-right is world -X in this renderer.
  assert.deepEqual(screenRelativeMove(0, -1, [0, -0.4, 1], [-1, 0, 0]), { x: 0, z: 1 });
  assert.deepEqual(screenRelativeMove(1, 0, [0, -0.4, 1], [-1, 0, 0]), { x: -1, z: 0 });
  assert.deepEqual(screenRelativeMove(-1, 0, [0, -0.4, 1], [-1, 0, 0]), { x: 1, z: 0 });
  assert.deepEqual(screenRelativeMove(0, 1, [0, -0.4, 1], [-1, 0, 0]), { x: 0, z: -1 });
});
