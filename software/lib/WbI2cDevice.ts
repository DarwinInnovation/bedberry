import pino from 'pino';
import { WbI2cBus, WbI2cDeviceCfg } from './WbI2cBus';

export class WbI2cDevice {
  public name: string;
  private address: number;

  constructor(private i2cBus: WbI2cBus, private cfg: WbI2cDeviceCfg) {
    i2cBus.info('Created i2c device type %s on address %d', cfg.type, cfg.address);
    this.name = cfg.name;
  }

  public init(): void { }

  public writeByteSync(subaddr: number, data: number) {
    return this.i2cBus.writeByteSync(this.cfg.address, subaddr, data);
  }

  public readByteSync(subaddr: number): number {
    return this.i2cBus.readByteSync(this.cfg.address, subaddr);
  }
}
