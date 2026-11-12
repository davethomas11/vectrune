import { initContext } from '../context';
import { createLogicApp } from '../logic';
import { makeReactive } from '../scope';
import { parseTrackToSteps } from '../statement';
import { installHost, mock } from './host';
import type { RuneApp, RuneWebConfig } from '../types';

let app: RuneApp;
let config: RuneWebConfig;
let flush: () => void;

export function boot(options: RuneWebConfig): void {
  config = options;
  flush = installHost();
  app = createLogicApp(function (this: RuneApp) { this.computeDerived(); });
  initContext({
    pageTree: config.pageTree,
    derivedDefinitions: config.derivedDefinitions,
    helperDefinitions: config.helperDefinitions,
    actionDefinitions: config.actionDefinitions,
    i18nData: config.i18nData,
    app, isRendering: false, memorySubscriptions: {},
    initialState: JSON.parse(JSON.stringify(config.stateJson)),
    emitters: config.emitters || {}, loadedChunks: {}, loadingChunks: {},
  });
  app.state = makeReactive({ ...config.stateJson, i18n: config.i18nData });
  if (typeof app.state.active_voice === 'string') {
    app.state.active_steps = parseTrackToSteps(String(app.state[`${app.state.active_voice}_track`] || ''), Number(app.state.selected_step_id ?? -1), String(app.state.time_signature || '4/4'), Number(app.state.selected_bar ?? 0));
  }
  app.computeDerived();
  flush();
}

export function invoke(name: string, args: unknown[]): void {
  if (!Object.prototype.hasOwnProperty.call(config.actionDefinitions, name)) {
    throw new Error(`Unknown Rune-Web action: ${name}`);
  }
  app.invokeAction(name, args);
  flush();
  app.computeDerived();
}

export function snapshot(): string {
  flush();
  return JSON.stringify({ state: app.state, derived: app.derived, mock });
}
