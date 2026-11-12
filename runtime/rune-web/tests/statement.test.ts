import { describe, it, expect, beforeEach } from 'vitest';
import { initContext } from '../src/context';
import { assignPath, deletePath, executeStatement, executeSteps } from '../src/statement';
import { evaluateExpression } from '../src/expression';
import type { RuneApp, EmitterConfig } from '../src/types';

function setupTestContext(
  state: Record<string, unknown> = {},
  emitters: Record<string, EmitterConfig> = {},
) {
  const app: RuneApp = {
    state: { ...state },
    derived: {},
    computeDerived: () => {},
    render: () => {},
    invokeAction: () => {},
  };
  initContext({
    pageTree: { Text: '' },
    derivedDefinitions: {},
    helperDefinitions: {},
    actionDefinitions: {},
    i18nData: {},
    app,
    isRendering: false,
    memorySubscriptions: {},
    emitters,
  });
  return app;
}

describe('assignPath', () => {
  it('assigns to top-level state', () => {
    const app = setupTestContext({ count: 0 });
    assignPath('count', 5, {});
    expect(app.state.count).toBe(5);
  });

  it('assigns to nested path', () => {
    const app = setupTestContext({ user: { name: 'old' } });
    assignPath('user.name', 'new', {});
    expect((app.state.user as Record<string, unknown>).name).toBe('new');
  });

  it('assigns to locals when key exists in locals', () => {
    const app = setupTestContext({ x: 'state' });
    const locals: Record<string, unknown> = { x: 'local' };
    assignPath('x', 'updated', locals);
    expect(locals.x).toBe('updated');
    expect(app.state.x).toBe('state'); // state unchanged
  });
});

describe('deletePath', () => {
  it('deletes from array by filter', () => {
    const app = setupTestContext({
      todos: [
        { id: 1, text: 'a' },
        { id: 2, text: 'b' },
        { id: 3, text: 'c' },
      ],
    });
    deletePath('todos[].(it.id == id)', { id: 2 });
    expect((app.state.todos as unknown[]).length).toBe(2);
    expect(
      (app.state.todos as Array<{ id: number }>).find((t) => t.id === 2),
    ).toBeUndefined();
  });

  it('deletes from array using shorthand', () => {
    const app = setupTestContext({
      todos: [
        { id: 1, text: 'a' },
        { id: 2, text: 'b' },
      ],
    });
    // The shorthand []id gets expanded to [].(it.id == id)
    deletePath('todos[]id', { id: 1 });
    expect((app.state.todos as unknown[]).length).toBe(1);
  });
});

describe('executeStatement', () => {
  it('handles assignment', () => {
    const app = setupTestContext({ x: 0 });
    executeStatement('x = 5', {});
    expect(app.state.x).toBe(5);
  });

  it('handles increment', () => {
    const app = setupTestContext({ count: 3 });
    executeStatement('count++', {});
    expect(app.state.count).toBe(4);
  });

  it('handles invert', () => {
    const app = setupTestContext({ flag: true });
    executeStatement('invert flag', {});
    expect(app.state.flag).toBe(false);
  });

  it('handles stop', () => {
    setupTestContext({});
    expect(executeStatement('stop', {})).toBe(false);
  });

  it('handles push', () => {
    const app = setupTestContext({ items: [1, 2] });
    executeStatement('items.push(3)', {});
    expect(app.state.items).toEqual([1, 2, 3]);
  });

  it('handles delete', () => {
    const app = setupTestContext({
      todos: [
        { id: 1, text: 'a' },
        { id: 2, text: 'b' },
      ],
    });
    executeStatement('delete todos[].(it.id == id)', { id: 1 });
    expect((app.state.todos as unknown[]).length).toBe(1);
  });

  it('handles compound assignments', () => {
    const app = setupTestContext({ score: 10, lives: 3, speed: 2, energy: 100 });
    executeStatement('score += 20', {});
    expect(app.state.score).toBe(30);

    executeStatement('lives -= 1', {});
    expect(app.state.lives).toBe(2);

    executeStatement('speed *= 3', {});
    expect(app.state.speed).toBe(6);

    executeStatement('energy /= 2', {});
    expect(app.state.energy).toBe(50);
  });

  it('handles restore / reset shorthand', () => {
    const app = setupTestContext({
      aliens: [
        { x: 100, y: 80, start_x: 50, start_y: 40, alive: false },
        { x: 150, y: 90, start_x: 115, start_y: 40, alive: false },
      ],
    });
    executeStatement('restore aliens', {});
    const aliens = app.state.aliens as any[];
    expect(aliens[0].x).toBe(50);
    expect(aliens[0].y).toBe(40);
    expect(aliens[0].alive).toBe(true);
    expect(aliens[1].x).toBe(115);
    expect(aliens[1].y).toBe(40);
    expect(aliens[1].alive).toBe(true);

    // Also test dot method call aliens.restore()
    aliens[0].x = 999;
    executeStatement('aliens.restore()', {});
    expect(aliens[0].x).toBe(50);
  });

  it('handles particle burst on declared emitter', () => {
    const app = setupTestContext(
      { particles: [] },
      { particles: { life: 10, friction: 0.9, size: [2, 4] } },
    );
    executeStatement('particles.burst(100, 50, 6, "#ff2a85", 5)', {});
    const ps = app.state.particles as any[];
    expect(ps.length).toBe(6);
    expect(ps[0].x).toBe(100);
    expect(ps[0].y).toBe(50);
    expect(ps[0].color).toBe('#ff2a85');
    expect(ps[0].life).toBe(10);
    expect(ps[0].max_life).toBe(10);
    expect(ps[0].size).toBeGreaterThanOrEqual(2);
    expect(ps[0].size).toBeLessThanOrEqual(4);

    // Bursts accumulate
    executeStatement('particles.burst(10, 10)', {});
    expect((app.state.particles as any[]).length).toBe(14);
  });

  it('handles particle step: moves, applies friction, decays and removes dead particles', () => {
    const app = setupTestContext(
      {
        particles: [
          { x: 0, y: 0, vx: 10, vy: -5, life: 5, max_life: 5 },
          { x: 0, y: 0, vx: 1, vy: 1, life: 1, max_life: 5 },
        ],
      },
      { particles: { friction: 0.92 } },
    );
    executeStatement('particles.step()', {});
    const ps = app.state.particles as any[];
    expect(ps.length).toBe(1);
    expect(ps[0].x).toBe(10);
    expect(ps[0].y).toBe(-5);
    expect(ps[0].life).toBe(4);
    expect(ps[0].vx).toBeCloseTo(9.2);
  });

  it('does not treat regular arrays without emitter config as particle emitters', () => {
    const app = setupTestContext({
      enemies: [{ id: 1, life: 1 }],
    });
    // Calling step() or burst() on non-emitter should not run particle logic
    executeStatement('enemies.step()', {});
    expect((app.state.enemies as any[]).length).toBe(1);
  });

  it('handles sound statements without throwing when audio is unavailable', () => {
    setupTestContext({});
    expect(() => executeStatement('sound "laser"', {})).not.toThrow();
    expect(() => executeStatement('sound.play("explosion")', {})).not.toThrow();
    expect(() => executeStatement('play_sound("hit")', {})).not.toThrow();
  });

  it('handles music statements without throwing when audio is unavailable', () => {
    setupTestContext({});
    expect(() => executeStatement('music "chiptune"', {})).not.toThrow();
    expect(() => executeStatement('music.play("arcade")', {})).not.toThrow();
    expect(() => executeStatement('music.pause', {})).not.toThrow();
    expect(() => executeStatement('music.resume', {})).not.toThrow();
    expect(() => executeStatement('music.tempo = 150', {})).not.toThrow();
    expect(() => executeStatement('music.volume = 0.25', {})).not.toThrow();
    expect(() => executeStatement('music.stop', {})).not.toThrow();
    expect(() => executeStatement('music.compose("test_song", 140, "C4:8", "C2:4", "kick:4")', {})).not.toThrow();
  });

  it('handles local storage and download statements', () => {
    setupTestContext({});
    executeStatement('storage.set("track_name", "Cyberpunk")', {});
    expect(evaluateExpression('storage.get("track_name")', {})).toBe('Cyberpunk');
    expect(evaluateExpression('storage.has("track_name")', {})).toBe(true);

    executeStatement('storage.set("track_meta", { "bpm": 150 })', {});
    expect(evaluateExpression('storage.get("track_meta").bpm', {})).toBe(150);

    executeStatement('storage.remove("track_name")', {});
    expect(evaluateExpression('storage.get("track_name")', {})).toBe(null);
    expect(evaluateExpression('storage.get("track_name", "default_val")', {})).toBe('default_val');

    expect(() => executeStatement('download("test.rune", "content")', {})).not.toThrow();
    expect(() => executeStatement('copy("music code")', {})).not.toThrow();
  });

  it('updates state and active_steps on selectSong', () => {
    const app = setupTestContext({
      selected_song: 'vectraiders',
      active_voice: 'lead',
      lead_track: 'E4:8 D4:8',
      time_signature: '4/4',
    });
    const steps = [
      { Statement: 'selected_song = name' },
      {
        Conditional: {
          condition: 'name == "vectworms"',
          steps: [
            { Statement: 'lead_track = "C4:8 G4:8"' },
            { Statement: 'time_signature = "4/4"' },
          ],
        },
      },
      { Statement: 'music.sync_steps' },
    ];
    executeSteps(steps, { name: 'vectworms' });
    expect(app.state.selected_song).toBe('vectworms');
    expect(app.state.lead_track).toBe('C4:8 G4:8');
    expect((app.state.active_steps as any[])[0].note).toBe('C4');
  });

  it('stretches and deletes steps correctly', () => {
    const app = setupTestContext({
      selected_song: 'test_song',
      active_voice: 'lead',
      lead_track: 'C4:8 E4:8 G4:4',
      time_signature: '4/4',
    });
    // Stretch step 0 from :8 to :4
    executeStatement('music.stretch_step(0, 1)', {});
    expect(app.state.lead_track).toBe('C4:4 E4:8 G4:4');
    expect((app.state.active_steps as any[])[0].duration).toBe(':4');
    expect((app.state.active_steps as any[])[0].matrix_width).toBeGreaterThan(60);

    // Shorten step 0 from :4 back to :8
    executeStatement('music.stretch_step(0, -1)', {});
    expect(app.state.lead_track).toBe('C4:8 E4:8 G4:4');

    // Delete step 1 (E4:8)
    executeStatement('music.delete_step(1)', {});
    expect(app.state.lead_track).toBe('C4:8 G4:4');
    expect((app.state.active_steps as any[]).length).toBe(2);
  });
});
