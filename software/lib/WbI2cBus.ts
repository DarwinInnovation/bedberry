import { Logger } from "./Logger";
import * as i2c from "i2c-bus";
import { WbI2cDevice } from "./WbI2cDevice";

export interface WbI2cDeviceCfg {
  address: number;
  type: string;
  name: string;
  details?: any;
}

export interface WbI2cBusCfg {
  busId: number;
  devices: WbI2cDeviceCfg[];
}

interface WbI2cDeviceTypeClass {
  new (bus: WbI2cBus, cfg: WbI2cDeviceCfg): WbI2cDevice;
}

export interface WbI2cDeviceTypeDescriptor {
  match: RegExp;
  name: string;
  impl: WbI2cDeviceTypeClass;
}

export class WbI2cBus {
  private i2cBus: i2c.I2cBus;
  private i2cDevices: WbI2cDevice[];
  private log: Logger;

  static I2cDeviceTypes: WbI2cDeviceTypeDescriptor[] = [];

  static AddDeviceType(desc: WbI2cDeviceTypeDescriptor) {
    WbI2cBus.I2cDeviceTypes.push(desc);
  }

  constructor(parentlog: Logger, private cfg: WbI2cBusCfg) {
    this.log = parentlog; //.child({ i2c: cfg.busId });

    this.debug("Opening.");
    this.i2cBus = i2c.openSync(cfg.busId);
    this.info("Opened.");

    this.i2cDevices = [];

    this.parseCfg(cfg);
  }

  /**
   * FindByName
name: string   */
  public FindByName<T>(name: string): T | null {
    const dev = this.i2cDevices.find((dev) => dev.name === name);

    if (dev === null) {
      return null;
    } else {
      return dev as unknown as T;
    }
  }

  public list() {
    for (const dev of this.i2cDevices) {
      console.log(`Dev: ${dev.name}`)
    }
  }

  private parseCfg(cfg: WbI2cBusCfg): void {
    for (const c of cfg.devices) {
      this.info("%s %d", c.type, WbI2cBus.I2cDeviceTypes.length);
      const typeDesc = WbI2cBus.I2cDeviceTypes.find((td) =>
        td.match.test(c.type)
      );
      if (typeDesc === undefined) {
        continue;
      }
      const newDev = new typeDesc.impl(this, c);
      this.i2cDevices.push(newDev);
    }
  }

  public writeByteSync(addr: number, subaddr: number, data: number) {
    const wbuf = Buffer.from([subaddr, data]);
    this.info(
      "addr %s.%s wr > %s",
      addr.toString(16),
      subaddr.toString(16),
      data.toString(16)
    );
    this.i2cBus.i2cWriteSync(addr, wbuf.length, wbuf);
  }

  public readByteSync(addr: number, subaddr: number): number {
    const wbuf = Buffer.from([subaddr]);
    let rbuf = Buffer.alloc(1);
    this.i2cBus.i2cWriteSync(addr, wbuf.length, wbuf);

    const l = this.i2cBus.i2cReadSync(addr, rbuf.length, rbuf);
    this.info(
      "addr %s.%s rd < %s",
      addr.toString(16),
      subaddr.toString(16),
      rbuf[0].toString(16)
    );
    return rbuf[0];
  }

  public error(msg: string, ...args: any[]) {
    return this.log.error("i2c-%d: " + msg, this.cfg.busId, ...args);
  }

  public warn(msg: string, ...args: any[]) {
    return this.log.warn("i2c-%d: " + msg, this.cfg.busId, ...args);
  }

  public info(msg: string, ...args: any[]) {
    return this.log.info("i2c-%d: " + msg, this.cfg.busId, ...args);
  }

  public debug(msg: string, ...args: any[]) {
    return this.log.debug("i2c-%d: " + msg, this.cfg.busId, ...args);
  }

  public trace(msg: string, ...args: any[]) {
    return this.log.trace("i2c-%d: " + msg, this.cfg.busId, ...args);
  }
}
