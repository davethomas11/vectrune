import { GameControls } from '../input/game';
import type { ControlsProfile } from '../input/types';
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
  type WallOverride,
  type Presentation,
  type Stats3D,
  type DeferredLightingFrame,
} from './raycaster';
import { setActiveMap, type SpatialMap } from './spatial';
import { validatePointLights, type PointLight3D } from './lighting';
import type { BlockModel } from './model';
import { validateHud, type GameHud } from './hud';
import { validateWorld, validatedVoxelChunks } from './voxel';
import { sampleCamera, type CameraTrack } from './camera';
import { nearbyForRender, withEntityQueries } from './entities';
import { validateTether, type Tether3D } from './tether';
import type { SideMapData } from './sidemap';
import { OnScreenKeyboard } from './on_screen_keyboard';
import type { TvProfile } from './tv';

export interface TitleScene {
  lights?: string;
  things?: string[];
  tethers?: string[];
  map: MapData;
  camera: CameraTrack;
  fov: number;
  heading: string;
  subtitle: string;
  prompt: string;
}

export interface Pixel3DConfig {
  tv?: TvProfile;
  fov?: number;
  outline?: boolean;
  outlineColor?: number;
  renderRadius?: number;
  sideMaps?: Record<string, SideMapData>;
  cameraTrack?: CameraTrack;
  titleScene?: TitleScene;
  ui?: string;
  world?: string;
  lights?: string; // state field containing the voxel scene's point lights
  pauseUi?: string;
  restartAction?: string;
  clickToStart?: boolean;
  presentation?: Presentation;
  controls?: ControlsProfile;
  width: number;
  height: number;
  tickRate: number;
  runtime?: 'hybrid' | 'js' | 'native';
  textures: Record<string, Texture>;
  sprites: Record<string, Sprite>;
  models?: Record<string, BlockModel>;
  animations?: Record<string, { frames: string[]; fps: number }>;
  map: MapData;
  maps?: Record<string, MapData>;
  camera: string; // state path to camera {x, y, angle}
  things?: string[]; // state paths to arrays of things
  tethers?: string[]; // state paths to individual tethers or arrays of tethers
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
  readonly keyboard = new OnScreenKeyboard();
  private hudPadHeld = new Set<string>();
  private calloutFocus = 0;
  private uiFullscreen = false;
  consumeUiFullscreen(): boolean {
    const requested = this.uiFullscreen;
    this.uiFullscreen = false;
    return requested;
  }

  keyboardHud(): GameHud | undefined {
    const state = this.app.state;
    const field = this.paused && this.config.pauseUi && state.status === 'playing' ? this.config.pauseUi : this.config.ui;
    return field ? validateHud(state[field], this.config.sprites) : undefined;
  }

  keyboardKey(key: string, down: boolean, repeat = false): boolean {
    this.keyboard.sync(this.keyboardHud()?.keyboard);
    const handled = this.keyboard.physical(key, down, repeat, (a, args) => this.activate(a, args));
    if (handled) { this.controls?.clear(true); this.invalidateFrame(); }
    return handled;
  }

  keyboardControlEvent(event: { device: string; code: string; value: number | boolean; repeat?: boolean }): boolean {
    const hud = this.keyboardHud();
    if (!hud?.keyboard) {
      if (event.device === 'gamepad' && (hud?.callout || hud?.grid?.layout === 'sidebar')) return true;
      return event.device === 'keyboard' ? this.hudKey(event.code, Boolean(event.value), event.repeat) : false;
    }
    if (event.device !== 'keyboard') return true;
    const key = event.code.startsWith('Key') ? (this.keyboard.pressed.has('SHIFT') ? event.code.slice(3) : event.code.slice(3).toLowerCase()) :
      event.code.startsWith('Digit') ? event.code.slice(5) : event.code === 'Space' ? ' ' :
      event.code.startsWith('Shift') ? 'Shift' : event.code;
    return this.keyboardKey(key, Boolean(event.value), event.repeat);
  }

  hudKey(code: string, down: boolean, repeat = false): boolean {
    const hud = this.keyboardHud();
    if (hud?.callout && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Enter', 'Space', 'Escape', 'Backspace'].includes(code)) {
      const count = hud.callout.actions.length;
      if (down) {
        if (code.startsWith('Arrow') && count) this.calloutFocus = (this.calloutFocus + (code === 'ArrowLeft' || code === 'ArrowUp' ? -1 : 1) + count) % count;
        else if (!repeat && ['Enter', 'Space'].includes(code) && count) this.activate(hud.callout.actions[this.calloutFocus % count].action);
        else if (!repeat && hud.callout.dismissAction) this.activate(hud.callout.dismissAction);
      }
      this.controls?.clear(true); this.invalidateFrame(); return true;
    }
    if (hud?.grid?.layout === 'sidebar') {
      const grid = hud.grid;
      if (down && ['ArrowUp', 'ArrowDown'].includes(code) && grid.moveAction) this.activate(grid.moveAction, [code === 'ArrowUp' ? -1 : 1]);
      else if (down && !repeat && ['Enter', 'Space'].includes(code) && grid.moveAction) {
        const item = grid.items.find(i => i.selected && !i.disabled);
        if (item?.action) {
          if (grid.closeOnActivate && grid.dismissAction) this.activate(grid.dismissAction);
          if (item.action === 'host.fullscreen') this.uiFullscreen = true;
          else if (item.action === 'host.mute') this.muted = !this.muted;
          else this.activate(item.action, item.args ?? []);
        }
      } else if (down && !repeat && ['Escape', 'Backspace'].includes(code) && grid.dismissAction) this.activate(grid.dismissAction);
      else return false;
      this.controls?.clear(true); return true;
    }
    return false;
  }

  keyboardPads(pads: Parameters<OnScreenKeyboard['controller']>[0]): boolean {
    const hud = this.keyboardHud();
    this.keyboard.sync(hud?.keyboard);
    if (!hud?.keyboard) return false;
    this.keyboard.controller(pads, (a, args) => this.activate(a, args));
    if (!this.keyboardHud()?.keyboard) {
      this.hudPadHeld = new Set(pads.flatMap(p => p ? p.buttons.flatMap((b, i) => b.value > .5 ? [`${p.index}:${i}`] : []) : []));
    }
    this.invalidateFrame();
    return true;
  }

  hudPads(pads: Parameters<OnScreenKeyboard['controller']>[0]): boolean {
    if (this.keyboardPads(pads)) return true;
    const hud = this.keyboardHud();
    if (!hud?.callout && hud?.grid?.layout !== 'sidebar') { this.hudPadHeld.clear(); return false; }
    this.controls?.clear(true);
    const held = new Set<string>();
    for (const pad of pads) {
      if (!pad) continue;
      for (const button of [12, 13, 14, 15, 0, 1]) {
        if ((pad.buttons[button]?.value ?? 0) <= .5) continue;
        const id = `${pad.index}:${button}`; held.add(id);
        if (this.hudPadHeld.has(id)) continue;
        if (hud.callout) {
          const count = hud.callout.actions.length;
          if (button >= 12 && count) this.calloutFocus = (this.calloutFocus + (button === 12 || button === 14 ? -1 : 1) + count) % count;
          if (button === 0 && count) this.activate(hud.callout.actions[this.calloutFocus % count].action);
          if (button === 1 && count) this.activate(hud.callout.actions[count - 1].action);
        } else if (hud.grid) {
          if (button >= 12 && hud.grid.moveAction) this.activate(hud.grid.moveAction, [button === 12 || button === 14 ? -1 : 1]);
          if (button === 0) {
            const item = hud.grid.items.find(i => i.selected && !i.disabled);
            if (item?.action) {
              if (hud.grid.closeOnActivate && hud.grid.dismissAction) this.activate(hud.grid.dismissAction);
              if (item.action === 'host.fullscreen') this.uiFullscreen = true;
              else if (item.action === 'host.mute') this.muted = !this.muted;
              else this.activate(item.action, item.args ?? []);
            }
          }
          if (button === 1 && hud.grid.dismissAction) this.activate(hud.grid.dismissAction);
        }
      }
    }
    this.hudPadHeld = held;
    if (this.keyboardHud()?.keyboard) {
      this.keyboard.sync(this.keyboardHud()?.keyboard);
      this.keyboard.seedController(held);
    }
    this.invalidateFrame();
    return true;
  }
  readonly controls?: GameControls;
  readonly app: RuneApp;
  readonly raycaster: Raycaster3D;
  private readonly context: RuneContext;
  private _paused = false;
  private _muted = false;
  private frameRevision = 0;
  private presentedRevision = -1;

  /** Hosts can reuse the last pixels between simulation ticks. */
  invalidateFrame(): void { this.frameRevision++; }
  /** Browser presentation may fit a wider screen without changing game rules. */
  resizeViewport(width: number, height: number, hudScale = 1): void {
    if (this.raycaster.resize(width, height, hudScale)) this.invalidateFrame();
  }
  frameIfChanged(): Uint32Array | null {
    return this.presentIfChanged(() => { this.frame(); }) ? this.raycaster.buffer : null;
  }
  presentIfChanged(draw: () => void): boolean {
    if (this.presentedRevision === this.frameRevision) return false;
    draw();
    this.presentedRevision = this.frameRevision;
    return true;
  }

  get paused(): boolean {
    return this._paused;
  }
  set paused(value: boolean) {
    if (value === this._paused) return;
    if (value) this.flushSave();
    this._paused = value;
    this.invalidateFrame();
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

  /** The desktop host shares this renderer for features beyond its fixed-eye rasterizer. */
  get usesSharedRenderer(): boolean {
    if (this.config.tethers?.length) return true;
    const hud = this.config.ui ? this.app.state[this.config.ui] as GameHud | undefined : undefined;
    if (hud?.map || hud?.countdown !== undefined || hud?.theme || hud?.keyboard || hud?.buttons || hud?.callout || hud?.grid?.layout === 'sidebar') return true;
    const pauseHud = this.config.pauseUi ? this.app.state[this.config.pauseUi] as GameHud | undefined : undefined;
    if (pauseHud?.map || pauseHud?.theme || pauseHud?.keyboard || pauseHud?.buttons || pauseHud?.callout || pauseHud?.grid?.layout === 'sidebar') return true;
    const map = this.config.maps?.[this.currentMapName] ?? this.config.map;
    if (map.sky?.below !== undefined) return true;
    if (this.config.world || this.config.cameraTrack ||
        (this.config.titleScene && this.app.state.status === 'title') ||
        (this.config.fov !== undefined && this.config.fov !== 66)) return true;
    const camera = this.config.camera.split('.').reduce((v, key) => v?.[key], this.app.state as Record<string, any>) as Camera3D | undefined;
    return !!camera && ((camera.height ?? .5) !== .5 || (camera.pitch ?? 0) !== 0);
  }

  private save?: GameSave;
  get saveStatus(): 'saved' | 'session' | 'recovered' | undefined {
    return this.save?.status;
  }
  ticks = 0;
  presentationTicks = 0;
  private wasTitle = false;
  private currentMapName = '';
  private modelRadius = 0;

  constructor(readonly config: Pixel3DConfig, options: RuneWebConfig) {
    if(config.renderRadius!==undefined&&(!Number.isFinite(config.renderRadius)||config.renderRadius<=0||config.renderRadius>4096))throw new Error('renderRadius must be in (0, 4096]');
    for(const model of Object.values(config.models??{}))for(const block of model.blocks){
      this.modelRadius=Math.max(this.modelRadius,Math.hypot(...block.from.map((v,i)=>Math.max(Math.abs(v),Math.abs(v+block.size[i])))));
    }
    for(const sprite of Object.values(config.sprites))this.modelRadius=Math.max(this.modelRadius,Math.hypot(sprite.width/sprite.height/2,.5));
    if (typeof window === 'undefined') {
      Object.assign(globalThis, { window: globalThis });
    }

    this.raycaster = new Raycaster3D({
      fov: config.fov,
      outline: config.outline,
      outlineColor: config.outlineColor,
      width: config.width,
      height: config.height,
      textures: config.textures,
      sprites: config.sprites,
      models: config.models,
      map: config.map,
    });

    Object.assign(globalThis, {
      __RuneSpatialMaps: config.maps || {},
      __RuneSideMaps: config.sideMaps || {},
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
      compactScopes: true,
      memorySubscriptions: {},
      initialState: JSON.parse(JSON.stringify(options.stateJson)),
      loadedChunks: {},
      loadingChunks: {},
      navigator: null,
    };

    this.app.state = JSON.parse(JSON.stringify(options.stateJson));
    if (config.controls) this.controls = new GameControls(config.controls, this);
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
    this.syncScene();
    this.persist();
  }

  start(): void {
    this.invalidateFrame();
    stopMusic();
    this._paused = false;
    setAudioMuted(this._muted);
    this.ticks = 0;
    this.presentationTicks = 0;
    withContext(this.context, () => {
      this.app.invokeAction('start', []);
      this.app.computeDerived();
    });
    this.syncScene();
    this.persist();
  }

  step(input: Input3D = {}): void {
    if (input.start) {
      this.start();
      return;
    }
    if (this.paused) return;
    this.invalidateFrame();

    withContext(this.context, () => withEntityQueries(() => {
      const music = this.audioState;
      this.app.invokeAction('tick', [input, { track: music.track, playing: music.isPlaying }]);
      this.app.computeDerived();
    }));
    this.ticks++;
    this.syncScene();
    if (this.wasTitle) this.presentationTicks++;
    this.persist(false);
  }

  private syncScene(): void {
    const state = this.app.state as Record<string, any>;
    const title = state.status === 'title';
    if (title && !this.wasTitle) this.presentationTicks = 0;
    this.wasTitle = title;
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

  flushSave(): void {
    this.persist();
  }

  private persist(immediate = true): void {
    this.save?.persist(this.app.state, immediate);
  }

  hasAction(action: string): boolean {
    return Boolean(this.context.actionDefinitions[action]);
  }

  invoke(action: string, args: unknown[] = []): void {
    this.invalidateFrame();
    if (action === 'host.mute') {
      this.muted = !this.muted;
      return;
    }
    if (action === 'resume_game' || action === 'host.resume' || action === 'restart_current_stage') {
      this.paused = false;
    }
    if (action === this.config.restartAction) {
      if (this.app.state.status === 'playing' && !this.paused) return;
      this.paused = false;
      this.ticks = 0;
    }
    if (action === 'start') {
      this.start();
      return;
    }
    setAudioMuted(this._muted || this._paused);
    withContext(this.context, () => {
      this.app.invokeAction(action, args);
      this.app.computeDerived();
    });
    if (this._paused && this.app.state.status !== 'playing') {
      this._paused = false;
      setAudioMuted(this._muted);
      resumeMusic();
    } else if (this._paused) {
      pauseMusic();
    }
    this.syncScene();
    this.persist();
  }

  activate(action: string, args: unknown[] = []): void {
    if (this.config.menuSounds?.confirm) {
      playSound(this.config.menuSounds.confirm);
    }
    this.invoke(action, args);
  }

  pickThing(path: string, x: number, y: number): number {
    if (!this.config.things?.includes(path)) throw new Error('data-pixel-pick must name a declared Scene things array');
    const value: unknown = path.split('.').reduce<unknown>((v, key) =>
      v && typeof v === 'object' ? Reflect.get(v, key) : undefined, this.app.state);
    if (!Array.isArray(value)) throw new Error('data-pixel-pick must reference an array');
    const stats = this.renderState();
    this.frame();
    return this.raycaster.pickModels(stats.camera, value, x, y);
  }

  renderState(): {
    title_scene?: TitleScene;
    presentation_time: number;
    camera: Camera3D;
    things: Thing3D[];
    tethers: Tether3D[];
    lights: PointLight3D[];
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
    wall_overrides: WallOverride[];
    time: number;
    presentation?: Presentation;
    hud_text?: string;
    ui?: GameHud;
    paused: boolean;
  } {
    const state = this.app.state as Record<string, any>;
    const titleScene = state.status === 'title' ? this.config.titleScene : undefined;
    this.raycaster.config.world = !titleScene && this.config.world ? validateWorld(state[this.config.world]) : undefined;
    this.raycaster.setMap(titleScene?.map ?? (this.config.maps?.[this.currentMapName] || this.config.map));
    const authoredFov = titleScene?.fov ?? this.config.fov ?? 66;
    const aspectScale = (this.raycaster.width * this.config.height) / (this.raycaster.height * this.config.width);
    this.raycaster.fov = aspectScale === 1 ? authoredFov :
      Math.atan(Math.tan(authoredFov * Math.PI / 360) * aspectScale) * 360 / Math.PI;
    const presentationTime = this.presentationTicks / this.config.tickRate;

    // 1. Resolve camera
    const camVal = this.config.camera
      .split('.')
      .reduce((v, k) => v?.[k], state) as Camera3D;
    const track = titleScene?.camera ?? this.config.cameraTrack;
    const camera: Camera3D = track ? sampleCamera(track, titleScene ? presentationTime : this.ticks / this.config.tickRate)
      : camVal || { x: 2.5, y: 2.5, angle: 0 };

    // 2. Resolve things
    let things: Thing3D[] = [];
    const radius=this.config.renderRadius??this.raycaster.config.world?.renderDistance;
    const origin={x:camera.x,y:camera.y,z:camera.z??camera.height??0};
    const thingPaths = titleScene?.things ?? this.config.things;
    if (thingPaths) {
      for (const path of thingPaths) {
        const val = path.split('.').reduce((v, k) => v?.[k], state);
        if (Array.isArray(val)) {
          const local=radius===undefined?val:nearbyForRender(val,origin,radius+2,this.modelRadius);
          for(const thing of local)things.push(thing);
        } else if (val && typeof val === 'object' &&
          typeof val.x === 'number' && typeof val.y === 'number' &&
          (typeof val.sprite === 'string' || typeof val.model === 'string')) {
          if(radius===undefined||Math.hypot(val.x-origin.x,val.y-origin.y,(val.z??0)-origin.z)<=radius+2+this.modelRadius*(val.scale??1))things.push(val as Thing3D);
        }
      }
    }
    for (const thing of things) {
      if (!titleScene && this.config.world && thing.sprite && thing.visible !== false) {
        throw new Error('Voxel world entities must use block models rather than billboard sprites');
      }
      if (!thing.model || thing.visible === false) continue;
      if (!this.config.models?.[thing.model]) throw new Error(`Unknown pixel-3d model: ${thing.model}`);
      if (thing.sprite) throw new Error('Pixel-3d things must use either model or sprite, not both');
      if (!Number.isFinite(thing.dissolve ?? 0) || (thing.dissolve ?? 0) < 0 || (thing.dissolve ?? 0) > 1) {
        throw new Error('Pixel-3d model dissolve must be between 0 and 1');
      }
      if (![thing.x, thing.y, thing.z ?? 0, thing.angle ?? 0, thing.pitch ?? 0, thing.scale ?? 1].every(Number.isFinite) ||
          (thing.scale ?? 1) <= 0) throw new Error('Pixel-3d model position/angle must be finite and scale must be positive');
    }
    const tethers: Tether3D[] = [];
    const tetherPaths = titleScene ? titleScene.tethers : this.config.tethers;
    for (const path of tetherPaths ?? []) {
      const value = path.split('.').reduce((v, k) => v?.[k], state);
      for (const item of Array.isArray(value) ? value : [value]) {
        if (item === null || item === undefined) continue;
        if (tethers.length >= 64) throw new Error('Pixel-3d supports up to 64 tethers per frame');
        tethers.push(validateTether(item));
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

    const lights = titleScene ? titleScene.lights : this.config.lights;
    return {
      title_scene: titleScene,
      presentation_time: presentationTime,
      camera,
      things,
      tethers,
      lights: lights ? validatePointLights(state[lights]) : [],
      weapon: titleScene ? undefined : weapon,
      flash: titleScene ? 0 : flash,
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
      ui: this.paused && this.config.pauseUi && status === 'playing'
        ? validateHud(state[this.config.pauseUi], this.config.sprites)
        : this.config.ui ? validateHud(state[this.config.ui], this.config.sprites) : undefined,
      paused: this.paused,
      time: this.ticks / this.config.tickRate,
      presentation: this.config.presentation,
      hud_text: this.app.derived.hud_text !== undefined
        ? String(this.app.derived.hud_text)
        : state.hud_text ? String(state.hud_text) : undefined,
      wall_overrides: Array.isArray(state.wall_overrides)
        ? state.wall_overrides.flatMap((tile: any) => {
            const texture = Object.keys(this.config.textures).indexOf(tile.texture);
            return texture >= 0 ? [{ x: tile.x, y: tile.y, texture }] : [];
          }) : [],
    };
  }

  frameHud(stats: ReturnType<Pixel3DEngine['renderState']>): Stats3D {
    let ui = stats.ui;
    if (ui?.callout) {
      const point = this.raycaster.projectPoint(stats.camera, ui.callout.target);
      const scale = this.raycaster.hudScale;
      ui = { ...ui, callout: { ...ui.callout, selected: this.calloutFocus % Math.max(1, ui.callout.actions.length),
        screen: point ? { x: point.x / scale, y: point.y / scale } : undefined } };
    }
    if (ui?.buttons) ui = { ...ui, buttons: ui.buttons.map(b => b.icon === 'sound' ? { ...b, selected: this.muted } : b) };
    this.keyboard.sync(ui?.keyboard);
    return {
      keyboard: ui?.keyboard ? this.keyboard : undefined,
      titleScene: stats.title_scene,
      presentationTime: stats.presentation_time,
      status: stats.status,
      heading: stats.camera.angle,
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
      ui,
      paused: stats.paused,
      presentation: stats.presentation,
      hudText: stats.hud_text,
    };
  }

  frame(deferredLighting?: (frame: DeferredLightingFrame) => void): Uint32Array {
    this.invalidateFrame();
    const stats = this.renderState();
    const world = this.raycaster.config.world;
    this.raycaster.render(stats.camera, stats.things, stats.weapon, stats.flash, this.frameHud(stats),
      stats.wall_overrides, stats.title_scene ? stats.presentation_time : stats.time,
      world && !stats.camera.terrainPose ? validatedVoxelChunks(world) : undefined, stats.tethers, stats.lights,
      deferredLighting);
    return this.raycaster.buffer;
  }
}
