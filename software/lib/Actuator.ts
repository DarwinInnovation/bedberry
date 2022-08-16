import process from "process";

import { Logger } from "./Logger";
import { MCP23017Port } from "../lib/MCP23017";

export interface ActuatorCfg {
  up: number;
  down: number;
}

enum ActuatorState {
  Stopped,
  Moving,
}

export enum ActuatorCmdType {
  // Basic command types
  Stop = "stop",
  Move = "move",

  // Helper types, these are converted to the above
  Up = "up",
  Down = "down",
}

export interface ActuatorCmd {
  type: ActuatorCmdType;
  duration?: number;
  dirIsUp?: boolean;
}

interface ActuatorCmdInternal {
  type: ActuatorCmdType;
  dirIsUp: boolean;
  duration: number;
  timestamp: number;
}

export class Actuator {
  private curState: ActuatorState;
  private curDirIsUp: boolean;
  private cmdTime: number;
  private stopTime: number;
  private stopTimer: NodeJS.Timer | null;

  private cmdQueue: ActuatorCmdInternal[];

  constructor(
    private log: Logger,
    private name: string,
    private mcpPort: MCP23017Port,
    private cfg: ActuatorCfg
  ) {
    this.cmdQueue = [];
    this.curState = ActuatorState.Stopped;
  }

  move(dir_is_up: boolean) {
    this.log.info("%s: actuator %s", this.name, dir_is_up ? "UP" : "DOWN");
    this.mcpPort.setBit(this.cfg.down, !dir_is_up);
    this.mcpPort.setBit(this.cfg.up, dir_is_up);
  }

  stop() {
    this.log.info("%s: actuator STOP", this.name);
    this.mcpPort.setBit(this.cfg.down, false);
    this.mcpPort.setBit(this.cfg.up, false);
  }

  cmd(inCmd: ActuatorCmd) {
    let cmd: ActuatorCmdInternal = {
      timestamp: process.uptime(),
      duration: inCmd.duration || 30,
      type: inCmd.type,
      dirIsUp: inCmd.dirIsUp || inCmd.type === "up",
    };

    if (cmd.type === ActuatorCmdType.Up) {
      cmd.type = ActuatorCmdType.Move;
      cmd.dirIsUp = true;
    } else if (cmd.type === ActuatorCmdType.Down) {
      cmd.type = ActuatorCmdType.Move;
      cmd.dirIsUp = false;
    }

    this.cmdQueue.push(cmd);
    process.nextTick(() => {
      this._processQueue();
    });
  }

  _processQueue() {
    if (this.cmdQueue.length == 0) {
      return;
    }
    const cmd = this.cmdQueue.shift();

    this.log.info("Process: ", cmd);

    if (this.curState == ActuatorState.Stopped) {
      this.curState = this._stateStopped(cmd);
    } else {
      this.curState = this._stateMoving(cmd);
    }

    process.nextTick(() => {
      this._processQueue();
    });
  }

  _stateStopped(cmd: ActuatorCmdInternal): ActuatorState {
    if (cmd.type == ActuatorCmdType.Stop) {
      return ActuatorState.Stopped;
    }
    if (cmd.type == ActuatorCmdType.Move) {
      this._stopTimerClear();

      this.move(cmd.dirIsUp);

      this._startTimerStart(cmd);

      return ActuatorState.Moving;
    }

    return this.curState;
  }

  _stateMoving(cmd: ActuatorCmdInternal): ActuatorState {
    if (cmd.type == ActuatorCmdType.Stop) {
      this._stopTimerClear();

      this.stop();

      return ActuatorState.Stopped;
    }
    if (cmd.type == ActuatorCmdType.Move) {
      this._stopTimerClear();

      this.move(cmd.dirIsUp);

      this._startTimerStart(cmd);

      return ActuatorState.Moving;
    }
    return this.curState;
  }

  _stopTimerClear() {
    clearTimeout(this.stopTimer);
    this.stopTimer = null;
    this.stopTime = 0;
  }

  _startTimerStart(cmd: ActuatorCmdInternal) {
    if (cmd.duration) {
      this.stopTime = cmd.timestamp + cmd.duration;
      this.stopTimer = setTimeout(() => {
        this.stop();
        this.curState = ActuatorState.Stopped;
      }, (this.stopTime - process.uptime()) * 1000);
    }
  }
}
