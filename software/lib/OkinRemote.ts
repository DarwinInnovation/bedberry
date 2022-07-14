import { Logger } from "./Logger";

import { MCP23017, MCP23017PortId, MCP23017Port } from "./MCP23017";
import { OkinBed } from "./OkinBed";

export interface OkinRemoteDirMap {
  up: number;
  down: number;
}

export interface OkinRemoteCfg {
  mcp_port: string;
  head: OkinRemoteDirMap;
  feet: OkinRemoteDirMap;
  platform: OkinRemoteDirMap;
}

interface OkinRemoteActuatorDir {
  actuator: string;
  dirIsUp: boolean;
}

export class OkinRemote {
  private mcpPort: MCP23017Port;
  private bitToActuator: Map<number, OkinRemoteActuatorDir>;

  constructor(
    private log: Logger,
    private okinBed: OkinBed,
    private cfg: OkinRemoteCfg
  ) {
    this.mcpPort = MCP23017.PortByName(cfg.mcp_port);

    this.mcpPort.on("change", (bits: number, value: number) => {
      this._onChange(bits, value);
    });
    this.log.info("OkinRemote");

    this.bitToActuator = new Map<number, OkinRemoteActuatorDir>();

    this.bitToActuator.set(cfg.head.up, { actuator: "head", dirIsUp: true });
    this.bitToActuator.set(cfg.head.down, { actuator: "head", dirIsUp: false });
    this.bitToActuator.set(cfg.feet.up, { actuator: "feet", dirIsUp: true });
    this.bitToActuator.set(cfg.feet.down, { actuator: "feet", dirIsUp: false });
    this.bitToActuator.set(cfg.platform.up, {
      actuator: "platform",
      dirIsUp: true,
    });
    this.bitToActuator.set(cfg.platform.down, {
      actuator: "platform",
      dirIsUp: false,
    });
  }

  _onChange(bits: number, value: number) {
    this.log.info("remote change %s %s", bits.toString(16), value.toString(16));
    if (value === 0) {
      this.okinBed.stopAll();
      return;
    }

    let bit = 0;
    while (bits) {
      const bitValue = 1 << bit;
      if (bits & bitValue) {
        const actuatorDir = this.bitToActuator.get(bit);
        if (value & bitValue) {
          this.okinBed.move(actuatorDir.actuator, actuatorDir.dirIsUp, 60);
        } else {
          this.okinBed.stop(actuatorDir.actuator);
        }
        bits = bits ^ bitValue;
      }
      bit += 1;
    }
  }
}
