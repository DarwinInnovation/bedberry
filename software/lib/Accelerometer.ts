import { EventEmitter } from "events";
import { Logger } from "./Logger";

import phidget22 from "phidget22";

export interface AccelerometerCfg {
  acc_name: string;
}

export interface AccelerometerResult {
  magnitude: number;
  theta: number;
  phi: number;
  reading: [number, number, number];
}

export class Accelerometer extends EventEmitter {
  static Registry = new Map<string, Accelerometer>();

  static FindByName(name: string): Accelerometer {
    return Accelerometer.Registry.get(name);
  }

  static Register(name: string, acc: Accelerometer) {
    Accelerometer.Registry.set(name, acc);
  }

  static addAngleDegrees(angle1: number, angle2: number): number {
    let result = angle1 + angle2;
    while (result < -180) {
      result += 360;
    }
    while (result > 180) {
      result -= 360;
    }
    return result;
  }

  constructor(protected log: Logger, private name: string) {
    super();

    this.log.info("Registering Accelerometer '%s'", name);
    Accelerometer.Register(name, this);
  }

  public start(updateHz: number): void {}

  public stop(): void {}

  public get(): AccelerometerResult {
    return null;
  }
}
