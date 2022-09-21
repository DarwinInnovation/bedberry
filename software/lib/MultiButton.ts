import {exec} from "child_process";

import { Logger } from "./Logger";

import { MCP23017, MCP23017Port } from "./MCP23017";
import { MultiButtonCore, MultiButtonCoreConfig } from "./MultiButtonCore";
import { OkinBed } from "./OkinBed";

import _ from "lodash";

interface MultiButtonActionBed {
  type: "bed";
  actuator: "head" | "feet" | "platform";
  dirIsUp: boolean;
  period?: number;
}

interface MultiButtonActionURL {
  type: "url";
  url: string;
}

interface MultiButtonActionExt {
  type: "ext";
  command: string;
  timeout?: number;
  cwd?: string;
}

type MultiButtonAction = MultiButtonActionBed | MultiButtonActionURL | MultiButtonActionExt;

export interface MultiButtonActionTypes {
  hold?: MultiButtonAction;
  click?: MultiButtonAction;
}

export interface MultiButtonCfg {
  bit: number;
  timings?: MultiButtonCoreConfig;
  actions: MultiButtonActionTypes[];
}

type VoidFunction = null | (() => void);

export class MultiButton {
  private mask: number;
  private mb: MultiButtonCore;
  private currentAction: null | string = null;
  private onRelease: VoidFunction;

  private onClick: VoidFunction[] = [];
  private onHold: VoidFunction[] = [];

  constructor(
    private log: Logger,
    private okinBed: OkinBed,
    cfg: MultiButtonCfg
  ) {
    this.mb = new MultiButtonCore(log, cfg.timings);

    this.mask = 1 << cfg.bit;
    this.log.info("Multibutton");

    this.mb.on("click", (count: number) => {
      this._onClick(count);
    });
    this.mb.on("hold", (count: number) => {
      this._onHold(count);
    });
    this.mb.on("release", () => {
      this._onRelease();
    });

    this._setupActions(cfg.actions);
  }

  inputChange(val: boolean) {
    //if (diff & this.mask) {
      this.log.info(`mb change ${val?'high':'low'}`);
      this.mb.update(val);
    //}
  }

  getMask(): number {
    return this.mask;
  }

  _onClick(count: number) {
    this.currentAction = "click";

    const handler = this.onClick[count];
    if (handler) {
      handler();
    }

    this.currentAction = null;
  }

  _onHold(count: number) {
    this.currentAction = "hold";

    const handler = this.onHold[count];
    if (handler) {
      handler();
    }
  }

  _onRelease() {
    this.currentAction = null;
    if (this.onRelease) {
      this.onRelease();
    }
  }

  _onBed(details: MultiButtonActionBed) {
    this.okinBed.move(details.actuator, details.dirIsUp, details.period | 60);
    if (this.currentAction && this.currentAction == "hold") {
      this.onRelease = () => {
        this.okinBed.stop(details.actuator);
      };
    }
  }
  
  _onExt(details: MultiButtonActionExt) {
    this.log.info(`Exec'ing ${details.command}`)
    exec(details.command, {
      cwd: details.cwd || "/tmp",
      timeout: details.timeout || 60000
    }, (error, stdout, stderr)=>{
      if (error) {
        this.log.info(`'${details.command}' failed ${error.message}`);
      } else {
        this.log.info(`'${details.command}' success`);
      }
    });
  }

  _onUrl(details: MultiButtonActionURL) {
    this.log.info(`URL ${details.url}`);
    fetch(details.url)
    .then((res) => {
      this.log.info(`  URL ${details.url} Success`);
    })
    .catch((res: Response) => {
      this.log.info(`  URL ${details.url} Failed: ${res.status}`);
      res.text()
      .then((txt)=>{
        this.log.info(`  ${txt}`);
      })
    });
  }

  _calcHandler(action: MultiButtonAction) {
    let handler: (MultiButtonAction)=>void = this._onBed;

    if (action.type.toLowerCase() == "ext") {
      handler = this._onExt;
    } else if (action.type.toLowerCase() == "url") {
      handler = this._onUrl;
    }

    return handler.bind(this, action);
  }

  _setupActions(actions: MultiButtonActionTypes[]) {
    _.each(actions, (action, idx) => {
      if (action.click) {
        this.onClick[idx] = this._calcHandler(action.click);
      } else if (action.hold) {
        this.onHold[idx] = this._calcHandler(action.hold);
      }
    });
  }
}
