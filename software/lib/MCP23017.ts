import { EventEmitter } from "events";

import _ from "lodash";

import { WbI2cBus, WbI2cDeviceCfg } from "./WbI2cBus";
import { WbI2cDevice } from "./WbI2cDevice";

import { Gpio } from "onoff";

export enum MCP23017PortId {
  A = "A",
  B = "B",
}

enum MCP23017Reg {
  DEFVAL = 0x06,
  GPINTEN = 0x04,
  GPIO = 0x12,
  GPPU = 0x0c,
  INTCAP = 0x10,
  INTCON = 0x08,
  INTF = 0x0e,
  IOCON = 0x0a,
  IODIR = 0x00,
  IPOL = 0x02,
  OLAT = 0x14,
}

export interface MCP23017Cfg {
  i2cAddress: number;
}

export interface MCP23017PortCfgDetails {
  int_gpio: number | null;
  int_on_change: boolean;
  default: number;
  read_bits: number;
  write_bits: number;
  poll_period: number;
}

export class MCP23017Port extends EventEmitter {
  private offset: number;
  private intGpio: Gpio | null;
  private curRdValue: number;
  private curWrValue: number;
  private interval: NodeJS.Timeout;

  static DefaultDetails: MCP23017PortCfgDetails = {
    int_gpio: null,
    int_on_change: true,
    default: 0x00,
    read_bits: 0xff,
    write_bits: 0x00,
    poll_period: 0,
  };

  constructor(
    private mcp: MCP23017,
    private port: MCP23017PortId,
    private details: MCP23017PortCfgDetails
  ) {
    super();

    const isA = port === MCP23017PortId.A;
    this.offset = isA ? 0 : 1;

    this.curRdValue = details.default & details.read_bits;
    this.curWrValue = details.default & details.write_bits;

    if (this.details.int_gpio !== null) {
      this.intGpio = new Gpio(details.int_gpio, "in", "falling");
    } else {
      this.intGpio = null;
    }

    if (details.poll_period) {
      this.interval = setInterval(() => {
        const gpio = this.mcp.readByteSync(MCP23017Reg.GPIO + this.offset);

        this._update(gpio);
      }, details.poll_period);
    }
  }

  public initSetup(): void {
    this.writeRegSync(MCP23017Reg.IODIR, 0xff ^ this.details.write_bits);
    this.writeRegSync(MCP23017Reg.GPPU, 0xff);
    this.writeRegSync(MCP23017Reg.OLAT, 0x00);
    this.writeRegSync(MCP23017Reg.GPINTEN, 0x00);
    this.writeRegSync(MCP23017Reg.DEFVAL, 0x00);
    this.writeRegSync(MCP23017Reg.IPOL, 0x00);
    this.writeRegSync(MCP23017Reg.INTCON, 0x00);
    this.readRegSync(MCP23017Reg.INTCAP);
    this.readRegSync(MCP23017Reg.GPIO);

    if (this.details.int_gpio !== null) {
      this.intGpio.watch((level) => {
        this._isr();
      });
      if (this.details.int_on_change) {
        this.writeRegSync(MCP23017Reg.INTCON, 0xff ^ this.details.read_bits);
      } else {
        this.writeRegSync(MCP23017Reg.DEFVAL, this.details.default);
        this.writeRegSync(MCP23017Reg.INTCON, this.details.read_bits);
      }
      this.writeRegSync(MCP23017Reg.GPINTEN, this.details.read_bits);
    }
  }

  public set(val: number) {
    val = val & this.details.write_bits;
    this.writeRegSync(MCP23017Reg.OLAT, val);
    this.curWrValue = val;
  }

  public setBit(bit: number, val: boolean) {
    const bval = 1 << bit;
    const newVal = (this.curWrValue & (0xff ^ bval)) | (val ? bval : 0);
    this.set(newVal);
  }

  writeRegSync(reg: MCP23017Reg, data: number) {
    this.mcp.writeByteSync(reg + this.offset, data);
  }

  readRegSync(reg: MCP23017Reg) {
    return this.mcp.readByteSync(reg + this.offset);
  }

  private _isr() {
    const intcap = this.mcp.readByteSync(MCP23017Reg.INTCAP + this.offset);
    const gpio0 = this.mcp.readByteSync(MCP23017Reg.GPIO + this.offset);
    this._update(intcap);
    this._update(gpio0);
    console.log(intcap, gpio0);
  }

  private _update(val: number) {
    let diff = (val ^ this.curRdValue) & this.details.read_bits;
    this.curRdValue = val; //this.curRdValue ^ diff;

    if (diff) {
      this.emit("change", diff, this.curRdValue);
    }
  }
}

export class MCP23017 extends WbI2cDevice {
  private ports: Map<MCP23017PortId, MCP23017Port>;
  static Registry: Map<string, MCP23017> = new Map<string, MCP23017>();

  static Init() {
    WbI2cBus.AddDeviceType({
      name: "MCP23017",
      match: /^mcp(?:23017)?$/i,
      impl: MCP23017,
    });
  }

  static FindByName(name: string): MCP23017 {
    return MCP23017.Registry.get(name);
  }

  static PortByName(name: string): MCP23017Port {
    const [mcp_name, port_id] = name.split(".");
    const mcp = MCP23017.Registry.get(mcp_name);
    return mcp.getPort(port_id as MCP23017PortId);
  }

  constructor(bus: WbI2cBus, cfg: WbI2cDeviceCfg) {
    super(bus, cfg);

    cfg.details = cfg.details || {};
    _.defaultsDeep(cfg.details, {
      A: {
        ...MCP23017Port.DefaultDetails,
      },
      B: {
        ...MCP23017Port.DefaultDetails,
      },
    });

    this.ports = new Map<MCP23017PortId, MCP23017Port>();
    this.ports.set(
      MCP23017PortId.A,
      new MCP23017Port(this, MCP23017PortId.A, cfg.details.A)
    );
    this.ports.set(
      MCP23017PortId.B,
      new MCP23017Port(this, MCP23017PortId.B, cfg.details.B)
    );

    this.initSetup();

    MCP23017.Registry.set(cfg.name, this);
  }

  public getPort(port: MCP23017PortId): MCP23017Port {
    return this.ports.get(port);
  }

  private initSetup(): void {
    this.writeByteSync(MCP23017Reg.IOCON, 0x00);

    this.getPort(MCP23017PortId.A).initSetup();
    this.getPort(MCP23017PortId.B).initSetup();
  }
}
