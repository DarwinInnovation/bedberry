import { Logger } from "./Logger";

import { MCP23017, MCP23017PortId, MCP23017Port } from "./MCP23017";
import { OkinBed } from "./OkinBed";
import { MultiButton, MultiButtonCfg } from "./MultiButton";

export interface OkinRemoteDirMap {
  up: number;
  down: number;
}

export interface OkinRemoteCfg {
  mcp_port: string;
  head: OkinRemoteDirMap;
  feet: OkinRemoteDirMap;
  platform: OkinRemoteDirMap;
  multibuttons?: MultiButtonCfg[]
}

interface OkinRemoteActuatorDir {
  actuator: string;
  dirIsUp: boolean;
}

export class OkinRemote {
  private mcpPort: MCP23017Port;
  private bitToActuator: Map<number, OkinRemoteActuatorDir>;
  private multibuttons: MultiButton[] = [];
  private mbMask: number = 0;
  private bedMask: number = 0;

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
    this.bedMask = (
      (1 << cfg.head.up) |
      (1 << cfg.head.down) |
      (1 << cfg.feet.up) |
      (1 << cfg.feet.down)
    );
    if (cfg.platform) {
      this.bitToActuator.set(cfg.platform.up, {
        actuator: "platform",
        dirIsUp: true,
      });
      this.bitToActuator.set(cfg.platform.down, {
        actuator: "platform",
        dirIsUp: false,
      });
      this.bedMask |= (
        (1 << cfg.platform.up) |
        (1 << cfg.platform.down)
      );
    }
    
    if (cfg.multibuttons) {
      for (const mbCfg of cfg.multibuttons) {
        const mb = new MultiButton(log, okinBed, mbCfg);
        this.multibuttons.push(mb);
        this.mbMask |= mb.getMask();
      }
    }
  }

  _onMbChange(bits: number, value: number) {
    for (const mb of this.multibuttons) {
      const mask = mb.getMask();
      this.log.info(`mb mask: ${mask}`);
      if (bits & mask) {
        this.log.info("mb change %s %s", bits.toString(16), (value & mask) == 0);
        mb.inputChange((value & mask) == 0);
        bits &= ~mask;
        value &= ~mask;
      }
    }
  }

  _onBedChange(bits: number, value: number) {
    if (value === 0) {
      this.okinBed.stopAll();
      return;
    }

    let bit = 0;
    while (bits) {
      const bitValue = 1 << bit;
      if (bits & bitValue) {
        const actuatorDir = this.bitToActuator.get(bit);
        if (actuatorDir) {
          if (value & bitValue) {
            this.okinBed.move(actuatorDir.actuator, actuatorDir.dirIsUp, 60);
          } else {
            this.okinBed.stop(actuatorDir.actuator);
          }
        }
        bits = bits ^ bitValue;
      }
      bit += 1;
    }
  }

  _onChange(bits: number, value: number) {
    this.log.info("remote change %s %s", bits.toString(16), value.toString(16));

    if (bits & this.mbMask) {
      this._onMbChange(bits & this.mbMask, value & this.mbMask)
    }
    if (bits & this.bedMask) {
      this._onBedChange(bits & this.bedMask, value & this.bedMask)
    }
  }
}
