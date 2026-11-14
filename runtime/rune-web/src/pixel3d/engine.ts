import { GameSave, type Persistence } from '../pixel/persistence';
import { withContext, type RuneContext } from '../context';
import { createLogicApp } from '../logic';
import {
  registerSounds,
  registerMusic,
  configureAudioHost,
  setAudioMuted,
  stopMusic,
  pauseMusic,
  resumeMusic,
  playSound,
} from '../audio';
import { audioSync } from '../audio_sync';
import type { RuneApp, RuneWebConfig } from '../types';
import type { Sprite } from '../pixel/engine';
import {
  Raycaster3D,
  type Texture,
  type MapData,
  type Camera3D,
  type Thing3D,
  type ViewmodelWeapon,
} from './raycaster';
import { setActiveMap, type SpatialMap } from './spatial';

export interface Pixel3DConfig {
  width: number;
  height: number;
  tickRate: number;
  runtime?: 'hybrid' | 'js' | 'native';
  textures: Record<string, Texture>;
  sprites: Record<string, Sprite>;
  animations?: Record<string, { frames: string[]; fps: number }>;
  map: MapData;
  maps?: Record<string, MapData>;
  camera: string; // state path to camera {x, y, angle}
  things?: string[]; // state paths to arrays of things
  weapon?: string; // state path to weapon {sprite, bob, flash}
  hud?: {
    health?: string;
    armor?: string;
    ammo?: string;
    score?: string;
    face?: string;
  };
  keys?: Record<string, string>;
  mouseLook?: boolean;
  commands?: Record<string, string>;
  persistence?: Persistence;
  menu?: string;
  menuSounds?: { move?: string; confirm?: string };
  overlays?: Record<string, string>;
}

export interface Input3D {
  [action: string]: boolean | number | undefined;
  look_x?: number; // mouse delta X
  look_y?: number; // mouse delta Y
}

export class Pixel3DEngine {
  readonly app: RuneApp;
  readonly raycaster: Raycaster3D;
  private readonly context: RuneContext;
  private _paused = false;
  private _muted = false;

  get paused(): boolean {
    return this._paused;
  }
  set paused(value: boolean) {
    if (value === this._paused) return;
    this._paused = value;
    if (value) pauseMusic();
    setAudioMuted(this._muted || value);
    if (!value) resumeMusic();
  }

  get muted(): boolean {
    return this._muted;
  }
  set muted(value: boolean) {
    this._muted = value;
    setAudioMuted(value || this._paused);
  }

  get audioState() {
    return audioSync.getSnapshot();
  }

  private save?: GameSave;
  ticks = 0;
  private currentMapName = '';

  constructor(readonly config: Pixel3DConfig, options: RuneWebConfig) {
    if (typeof window === 'undefined') {
      Object.assign(globalThis, { window: globalThis });
    }

    this.raycaster = new Raycaster3D({
      width: config.width,
      height: config.height,
      textures: config.textures,
      sprites: config.sprites,
      map: config.map,
    });

    const spatialMap: SpatialMap = {
      width: config.map.width,
      height: config.map.height,
      grid: config.map.grid,
    };
    setActiveMap(spatialMap);

    this.app = createLogicApp(function (this: RuneApp) {
      this.computeDerived();
    });

    this.context = {
      ...options,
      app: this.app,
      isRendering: false,
      memorySubscriptions: {},
      initialState: JSON.parse(JSON.stringify(options.stateJson)),
      loadedChunks: {},
      loadingChunks: {},
      navigator: null,
    };

    this.app.state = JSON.parse(JSON.stringify(options.stateJson));
    configureAudioHost({
      syncPage: false,
      deferPlayback: typeof document !== 'undefined',
    });
    registerSounds(options.sounds);
    registerMusic(options.music);

    if (config.persistence) {
      this.save = new GameSave(config.persistence);
      this.app.state[config.persistence.state] = this.save.load(
        this.app.state[config.persistence.state]
      );
    }

    withContext(this.context, () => {
      if (options.actionDefinitions.initialize) {
        this.app.invokeAction('initialize', []);
      }
      this.app.computeDerived();
    });
    this.persist();
  }

  start(): void {
    stopMusic();
    this._paused = false;
    setAudioMuted(this._muted);
    this.ticks = 0;
    withContext(this.context, () => {
      this.app.invokeAction('start', []);
      this.app.computeDerived();
    });
    this.persist();
  }

  step(input: Input3D = {}): void {
    if (input.start) {
      this.start();
      return;
    }
    if (this.paused) return;

    withContext(this.context, () => {
      this.app.invokeAction('tick', [input]);
      this.app.computeDerived();
    });
    this.ticks++;
    this.persist();

    // Check if map needs to switch
    const state = this.app.state as Record<string, any>;
    if (state.level_map && state.level_map !== this.currentMapName && this.config.maps?.[state.level_map]) {
      this.currentMapName = state.level_map;
      const newMap = this.config.maps[state.level_map];
      this.raycaster.setMap(newMap);
      setActiveMap({
        width: newMap.width,
        height: newMap.height,
        grid: newMap.grid,
      });
    }
  }

  private persist(): void {
    if (this.save) this.save.flush(this.app.state[this.save.config.state]);
  }

  invoke(action: string, args: unknown[] = []): void {
    if (action === 'start') {
      this.start();
      return;
    }
    this.paused = false;
    setAudioMuted(this._muted);
    withContext(this.context, () => {
      this.app.invokeAction(action, args);
      this.app.computeDerived();
    });
    this.persist();
  }

  activate(action: string, args: unknown[] = []): void {
    if (this.config.menuSounds?.confirm) {
      playSound(this.config.menuSounds.confirm);
    }
    this.invoke(action, args);
  }

  renderState(): {
    camera: Camera3D;
    things: Thing3D[];
    weapon?: ViewmodelWeapon;
    flash: number;
    status: string;
    health: number;
    ammo: number;
    score: number;
    kills: number;
    level: number;
    level_map?: string;
    level_title?: string;
    story_title?: string;
    story_body?: string;
    message?: string;
    switch_activated?: boolean;
  } {
    const state = this.app.state as Record<string, any>;

    // 1. Resolve camera
    const camVal = this.config.camera
      .split('.')
      .reduce((v, k) => v?.[k], state) as Camera3D;
    const camera: Camera3D = camVal || { x: 2.5, y: 2.5, angle: 0 };

    // 2. Resolve things
    const things: Thing3D[] = [];
    if (this.config.things) {
      for (const path of this.config.things) {
        const val = path.split('.').reduce((v, k) => v?.[k], state);
        if (Array.isArray(val)) {
          things.push(...val);
        } else if (val && typeof val === 'object') {
          things.push(val);
        }
      }
    }

    // 3. Resolve weapon
    let weapon: ViewmodelWeapon | undefined = undefined;
    if (this.config.weapon) {
      weapon = this.config.weapon
        .split('.')
        .reduce((v, k) => v?.[k], state) as ViewmodelWeapon;
    }

    // 4. Resolve flash / damage tint
    const flash = Number(state.flash || 0);

    // 5. Game status and stats
    const status = String(state.status || 'ready');
    const health = Number(state.health ?? 100);
    const ammo = Number(state.ammo ?? 24);
    const score = Number(state.score ?? 0);
    const kills = Number(state.kills ?? 0);
    const level = Number(state.level ?? 1);
    const level_map = state.level_map ? String(state.level_map) : undefined;
    const level_title = state.level_title ? String(state.level_title) : undefined;
    const story_title = state.story_title ? String(state.story_title) : undefined;
    const story_body = state.story_body ? String(state.story_body) : undefined;
    const message = state.message ? String(state.message) : undefined;
    const switch_activated = Boolean(state.switch_activated);

    return {
      camera,
      things,
      weapon,
      flash,
      status,
      health,
      ammo,
      score,
      kills,
      level,
      level_map,
      level_title,
      story_title,
      story_body,
      message,
      switch_activated,
    };
  }

  frame(): Uint32Array {
    const stats = this.renderState();
    this.raycaster.render(stats.camera, stats.things, stats.weapon, stats.flash, {
      status: stats.status,
      health: stats.health,
      ammo: stats.ammo,
      score: stats.score,
      kills: stats.kills,
      level: stats.level,
      levelTitle: stats.level_title,
      storyTitle: stats.story_title,
      storyBody: stats.story_body,
      message: stats.message,
      switchActivated: stats.switch_activated,
    });
    return this.raycaster.buffer;
  }
}

