import { EventEmitter } from "events";
import { Logger } from "./Logger";

import { ActuatorCfg, Actuator, ActuatorCmdType } from "./Actuator";
import { MCP23017, MCP23017PortId, MCP23017Port } from "./MCP23017";
import { Accelerometer, AccelerometerResult } from "./Accelerometer";
import l from "../server/logger";

export interface OkinBedDriveCfg {
  mcp_port: MCP23017PortId;
  head: ActuatorCfg;
  feet: ActuatorCfg;
  platform?: ActuatorCfg;
}

export interface OkinBedControl extends EventEmitter {}

export interface OkinBedCfg {
  mcp_port: string;
  acc_name?: string;

  head: ActuatorCfg;
  feet: ActuatorCfg;
  platform?: ActuatorCfg;

  max_move_duration: number;

  presetAngles: number[];

  control: OkinBedControl[];
}

interface OkinTarget {
  active: boolean;
  angle: number;
  dirIsUp: boolean;
  timestamp: number;
  limit: number;
}

export class OkinBed extends EventEmitter {
  private mcpPort: MCP23017Port;
  private actuators: Map<string, Actuator>;
  private accelerometer: Accelerometer;
  private targetInfo: OkinTarget;

  constructor(
    private log: Logger,
    private name: string,
    private cfg: OkinBedCfg
  ) {
    super();

    this.mcpPort = MCP23017.PortByName(cfg.mcp_port);

    this.actuators = new Map<string, Actuator>();
    this.actuators.set(
      "head",
      new Actuator(log, name + ".head", this.mcpPort, cfg.head)
    );
    this.actuators.set(
      "feet",
      new Actuator(log, name + ".feet", this.mcpPort, cfg.feet)
    );

    if (cfg.platform) {
      this.actuators.set(
        "platform",
        new Actuator(log, name + ".platform", this.mcpPort, cfg.platform)
      );
    }

    if (cfg.acc_name) {
      this.accelerometer = Accelerometer.FindByName(cfg.acc_name);
      this.accelerometer.on("reading", (result: AccelerometerResult) =>
        this._onAccResult(result)
      );
      this.targetInfo = {
        active: false,
        angle: 0,
        dirIsUp: true,
        timestamp: 0,
        limit: 0,
      };
    } else {
      this.accelerometer = null;
    }
  }

  stop(actuator: string) {
    this.actuators.get(actuator).cmd({
      type: ActuatorCmdType.Stop,
    });
  }

  stopAll() {
    this.actuators.forEach((act) => {
      act.cmd({
        type: ActuatorCmdType.Stop,
      });
    });
  }

  move(actuator: string, dir_is_up: boolean, duration?: number) {
    this.actuators.get(actuator).cmd({
      type: ActuatorCmdType.Move,
      dirIsUp: dir_is_up,
      duration,
    });
  }

  up(actuator: string, duration?: number) {
    this.move(actuator, true, duration);
  }

  down(actuator: string, duration?: number) {
    this.move(actuator, false, duration);
  }

  target(targetAngle: number) {
    if (!this.accelerometer) {
      return;
    }
    const curAngle = this.accelerometer.get().theta;
    this.log.info("OkinBed: Target %d (current: %d)", targetAngle, curAngle);

    if (Math.abs(targetAngle - curAngle) < 1) {
      this.log.info("OkinBed: at target - not moving");
      this.targetInfo.active = false;
      this.stop("head");
      return;
    }

    this.targetInfo.dirIsUp = targetAngle > curAngle;
    this.targetInfo.active = true;
    this.targetInfo.angle = targetAngle;
    this.targetInfo.timestamp = process.uptime();
    this.targetInfo.limit =
      this.targetInfo.timestamp + this.cfg.max_move_duration + 1;

    this.accelerometer.start(2);

    this.move("head", this.targetInfo.dirIsUp, this.cfg.max_move_duration + 10);
    this.log.info(
      "OkinBed: moving %s to reach target",
      this.targetInfo.dirIsUp ? "up" : "down"
    );
  }

  preset(presetId: number) {
    if (presetId < 1 || presetId > this.cfg.presetAngles.length) {
      return false;
    }

    this.target(this.cfg.presetAngles[presetId - 1]);
  }

  _onAccResult(result: AccelerometerResult) {
    const targetInfo = this.targetInfo;
    //this.log.info('acc %d', result.theta, result)
    if (targetInfo.active) {
      let reachedTarget = targetInfo.dirIsUp
        ? result.theta >= targetInfo.angle
        : result.theta <= targetInfo.angle;
      if (reachedTarget) {
        targetInfo.active = false;
        this.log.info("OkinBed: reached target, stoping");
      } else {
        if (process.uptime() > targetInfo.limit) {
          this.log.warn("Failed to reach target of %d", targetInfo.angle);
          targetInfo.active = false;
        }
      }
      if (!targetInfo.active) {
        this.stop("head");
        this.accelerometer.stop();
      }
    } else {
      this.accelerometer.stop();
    }
  }
}
