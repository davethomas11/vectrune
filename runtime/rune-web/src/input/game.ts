import { InputController } from './controller';
import type { ControlEvent, ControlsProfile } from './types';
interface Game {
  paused: boolean;
  muted: boolean;
  app: { state: Record<string, unknown> };
  start(): void;
  key?(code: string): boolean;
  invoke(action: string): void;
}
export const isPausableStatus = (status: unknown): boolean => ['playing','intro','landing','departing','ending','credits'].includes(String(status));

/** The same command and input semantics run in browser and native QuickJS. */
export class GameControls {
  readonly controller: InputController;
  constructor(profile: ControlsProfile, private game: Game) { this.controller = new InputController(profile); }
  get profile() { return this.controller.profile; }
  event(event: ControlEvent): string | undefined {
    const command = this.controller.event(event);
    return command ? this.command(command) : undefined;
  }
  command(command: string): string | undefined {
    if (command === 'host.fullscreen') return command;
    if (command !== 'host.mute') this.controller.clear(true);
    if (command === 'host.pause') {
      const status=this.game.app.state.status;
      if (isPausableStatus(status)) this.game.paused = !this.game.paused;
      else if (['title','won','gameover'].includes(String(status))) this.game.start();
    }
    else if (command === 'host.mute') this.game.muted = !this.game.muted;
    else if (command === 'host.start') { if (!this.game.key?.('Enter')) this.game.start(); }
    else if (command === 'host.advance') {
      if (this.game.app.state.status !== 'playing') this.game.invoke('advance');
    } else this.game.invoke(command);
  }
  gamepads(pads: Parameters<InputController['gamepads']>[0]): string[] {
    return this.controller.gamepads(pads).flatMap(command => { const host = this.command(command); return host ? [host] : []; });
  }
  sample(dt: number) { return this.controller.sample(dt); }
  clear(keepCommands = false) { this.controller.clear(keepCommands); }
}
