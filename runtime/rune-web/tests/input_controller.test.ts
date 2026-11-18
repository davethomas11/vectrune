import { describe, expect, it } from 'vitest';
import { InputController } from '../src/input/controller';
import type { ControlsProfile } from '../src/input/types';
const profile: ControlsProfile = {
  version: 1, name: 'test', keys: { Space: 'fire' }, commands: { KeyP: 'host.pause' },
  mouse: { Left: 'fire', MoveX: { input: 'look_x', scale: .5 } },
  gamepad: { Button7: 'fire', Axis0: { input: 'move_x', deadzone: .2 }, Axis2: { input: 'look_x', mode: 'rate', scale: 120 }, 'Axis1-': 'forward' },
};
describe('shared declarative input ledger', () => {
  it('keeps another device held when one releases the same action', () => {
    const input = new InputController(profile);
    input.event({ device: 'keyboard', code: 'Space', value: true });
    input.event({ device: 'mouse', code: 'Left', value: true });
    input.sample(1/30);
    input.event({ device: 'mouse', code: 'Left', value: false });
    expect(input.sample(1/30).fire).toBe(true);
    input.event({ device: 'keyboard', code: 'Space', value: false });
    expect(input.sample(1/30).fire).toBe(false);
  });
  it('queues short presses, drains mouse deltas and honors cancellation', () => {
    const input = new InputController(profile);
    input.event({ device: 'keyboard', code: 'Space', value: true });
    input.event({ device: 'keyboard', code: 'Space', value: false });
    input.event({ device: 'mouse', code: 'MoveX', value: 12 });
    input.event({ device: 'mouse', code: 'MoveX', value: 4 });
    expect(input.sample(1/30)).toEqual({ fire: true, look_x: 8 });
    expect(input.sample(1/30)).toEqual({ fire: false, look_x: 0 });
    input.event({ device: 'keyboard', code: 'Space', value: true });
    input.event({ device: 'keyboard', code: 'Space', value: false, cancel: true });
    expect(input.sample(1/30).fire).toBeUndefined();
  });
  it('emits commands on the initial press rather than key repeats', () => {
    const input = new InputController(profile);
    expect(input.event({ device: 'keyboard', code: 'KeyP', value: true })).toBe('host.pause');
    expect(input.event({ device: 'keyboard', code: 'KeyP', value: true })).toBeUndefined();
    input.event({ device: 'keyboard', code: 'KeyP', value: false });
    expect(input.event({ device: 'keyboard', code: 'KeyP', value: true })).toBe('host.pause');
  });
  it('normalizes gamepad dead zones, digital directions and rate axes', () => {
    const input = new InputController(profile);
    const pad = { index: 0, axes: [.6, -.9, 1], buttons: Array.from({length:8},()=>({value:0,pressed:false,touched:false})) };
    input.gamepads([pad]);
    const frame = input.sample(.1);
    expect(frame.move_x).toBeCloseTo(.5);
    expect(frame.forward).toBe(true);
    expect(frame.look_x).toBe(12);
    input.gamepads([]);
    expect(input.sample(.1)).toEqual({});
  });
});

import { GameControls } from '../src/input/game';
it('gamepad host commands fire once per press and survive pause input cleanup', () => {
  const game = { paused: false, muted: false, app: { state: { status: 'playing' } }, start() {}, invoke() {} };
  const controls = new GameControls({ ...profile, gamepad: { Button0: { command: 'host.pause' } } }, game);
  const pad = { index: 0, axes: [], buttons: [{ value: 1, pressed: true, touched: true }] };
  controls.gamepads([pad]); expect(game.paused).toBe(true);
  controls.gamepads([pad]); expect(game.paused).toBe(true);
  pad.buttons[0].value = 0; controls.gamepads([pad]);
  pad.buttons[0].value = 1; controls.gamepads([pad]); expect(game.paused).toBe(false);
});

it('preserves a held action when muting and releases every source on blur cleanup', () => {
  const game = { paused: false, muted: false, app: { state: { status: 'playing' } }, start() {}, invoke() {} };
  const controls = new GameControls(profile, game);
  controls.event({ device: 'keyboard', code: 'Space', value: true });
  controls.command('host.mute'); expect(game.muted).toBe(true);
  expect(controls.sample(.1).fire).toBe(true);
  controls.clear(); expect(controls.sample(.1)).toEqual({});
});

it('keeps Enter menu confirmation available when mapped to host.start', () => {
  let started = false, confirmed = false;
  const game = { paused: false, muted: false, app: { state: { status: 'store' } }, start() { started = true; }, invoke() {}, key(code: string) { confirmed = code === 'Enter'; return confirmed; } };
  const controls = new GameControls(profile, game);
  controls.command('host.start');
  expect(confirmed).toBe(true); expect(started).toBe(false);
});

it('keeps pause pressed through menu cleanup and rearms only on release', () => {
  const game = { paused: false, muted: false, app: { state: { status: 'playing' } }, start() {}, invoke() {} };
  const controls = new GameControls({ ...profile, gamepad: { Button9: { command: 'host.pause' }, Button0:'fire' } }, game);
  const pad = { index:0, axes:[], buttons:Array.from({length:10},()=>({value:0})) };
  pad.buttons[9].value=1;controls.gamepads([pad]);expect(game.paused).toBe(true);
  controls.clear(true); // The host opens its pause menu and clears gameplay inputs.
  for(let poll=0;poll<30;poll++)controls.gamepads([pad]);
  expect(game.paused).toBe(true);
  pad.buttons[9].value=0;controls.gamepads([pad]);
  pad.buttons[9].value=1;controls.gamepads([pad]);expect(game.paused).toBe(false);
  controls.clear(true); // Closing that menu must preserve the release latch too.
  for(let poll=0;poll<30;poll++)controls.gamepads([pad]);
  expect(game.paused).toBe(false);
  controls.clear(); // Focus loss/disconnect cleanup still releases every source.
  controls.gamepads([pad]);expect(game.paused).toBe(true);
});

it('uses controller Start to begin a title and pauses each cinematic state once per press',()=>{
 let started=0;
 const game={paused:false,muted:false,app:{state:{status:'title'}},start(){started++;this.app.state.status='intro';},invoke(){}};
 const controls=new GameControls({...profile,gamepad:{Button9:{command:'host.pause'}}},game);
 const pad={index:0,axes:[],buttons:Array.from({length:10},()=>({value:0}))};
 pad.buttons[9].value=1;controls.gamepads([pad]);controls.clear(true);controls.gamepads([pad]);
 expect(started).toBe(1);expect(game.paused).toBe(false);
 for(const status of ['intro','landing','departing','ending','credits']){
  game.app.state.status=status;game.paused=false;
  pad.buttons[9].value=0;controls.gamepads([pad]);pad.buttons[9].value=1;controls.gamepads([pad]);
  expect(game.paused).toBe(true);controls.clear(true);controls.gamepads([pad]);expect(game.paused).toBe(true);
 }
});
