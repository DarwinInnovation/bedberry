import { EventEmitter } from "events";
import { Logger } from "./Logger";

import {
  Accelerometer,
  AccelerometerCfg,
  AccelerometerResult,
} from "./Accelerometer";

import phidget22 from "phidget22";

export interface AccelerometerPhidgetCfg extends AccelerometerCfg {
  angleCorrection: {
    theta: number;
    phi: number;
  };
}

enum AccelerometerPhidgetState {
  Uninitialised,
  Connecting,
  Attaching,
  Filling,
  Idle,
  Running,
  Error,
}

export class AccelerometerPhidget extends Accelerometer {
  conn: any;
  acc: any;
  minDataInterval: number;
  maxDataInterval: number;
  curState: AccelerometerPhidgetState;

  counter: number;
  bufferLen: number;

  sampleBuffer: [number, number, number][];
  accelerationSum: [number, number, number];

  constructor(log: Logger, private cfg: AccelerometerPhidgetCfg) {
    super(log, "phidget"); //cfg.acc_name);
    this.curState = AccelerometerPhidgetState.Uninitialised;

    this.accelerationSum = [0, 0, 0];
    this.bufferLen = 16;
    this.sampleBuffer = [];
    this.counter = 0;

    this.conn = new phidget22.Connection();
    this.conn
      .connect()
      .then(() => {
        this.acc = new phidget22.Accelerometer();
        this.acc
          .open(2500)
          .then(() => {
            if (!this.acc.getAttached()) {
              this._setState(AccelerometerPhidgetState.Error);
              return;
            }

            this.minDataInterval = this.acc.getMinDataInterval();
            this.maxDataInterval = this.acc.getMaxDataInterval();

            this.acc.onAccelerationChange = (
              accSample: [number, number, number],
              timestamp: number
            ) => {
              this._submitSample(accSample, timestamp);
            };

            this.acc.setDataInterval(this.minDataInterval);
            this._setState(AccelerometerPhidgetState.Filling);
          })
          .catch(function (err) {
            console.error("Error during open:", err);
          });
        this._setState(AccelerometerPhidgetState.Attaching);
      })
      .catch(function (err) {
        console.error("Error during connect:", err);
      });
    this._setState(AccelerometerPhidgetState.Connecting);
  }

  public start(updateHz: number) {
    const period_ms = 1000 / updateHz;

    const targetInterval = period_ms / this.bufferLen;
    let dataInterval =
      (Math.floor(targetInterval / this.minDataInterval) + 1) *
      this.minDataInterval;

    dataInterval =
      dataInterval > this.maxDataInterval ? this.maxDataInterval : dataInterval;

    this.acc.setDataInterval(dataInterval);

    this._setState(AccelerometerPhidgetState.Running);
  }

  public stop() {
    this._setState(AccelerometerPhidgetState.Idle);
    this.acc.setDataInterval(this.maxDataInterval);
  }

  _setState(newState: AccelerometerPhidgetState) {
    this.curState = newState;
  }

  _stateIs(testState: AccelerometerPhidgetState): boolean {
    return testState === this.curState;
  }

  _submitSample(accSample: [number, number, number], timestamp: number) {
    this.sampleBuffer.push(accSample);
    this.accelerationSum[0] += accSample[0];
    this.accelerationSum[1] += accSample[1];
    this.accelerationSum[2] += accSample[2];

    if (this._stateIs(AccelerometerPhidgetState.Filling)) {
      if (this.sampleBuffer.length != this.bufferLen) {
        return;
      }
      this.acc.setDataInterval(this.maxDataInterval);
      this._setState(AccelerometerPhidgetState.Idle);
    } else {
      const oldSample = this.sampleBuffer.shift();
      this.accelerationSum[0] -= oldSample[0];
      this.accelerationSum[1] -= oldSample[1];
      this.accelerationSum[2] -= oldSample[2];
    }

    if (this._stateIs(AccelerometerPhidgetState.Running)) {
      this.counter += 1;
      if (this.counter == this.bufferLen) {
        this.emit("reading", this.get());
        this.counter = 0;
      }
    }
  }

  public get(): AccelerometerResult {
    const magnitude =
      Math.sqrt(
        this.accelerationSum[0] * this.accelerationSum[0] +
          this.accelerationSum[1] * this.accelerationSum[1] +
          this.accelerationSum[2] * this.accelerationSum[2]
      ) / this.bufferLen;

    let theta = 0;
    let phi = 0;

    if (Math.abs(this.accelerationSum[2]) < 1 / 4096) {
      theta =
        180 *
        (this.accelerationSum[0] >= 0 ? 1 : -1) *
        (this.accelerationSum[1] >= 0 ? 1 : -1);
      phi =
        180 *
        (this.accelerationSum[1] >= 0 ? 1 : -1) *
        (this.accelerationSum[0] >= 0 ? 1 : -1);
    } else {
      theta =
        Math.atan(this.accelerationSum[0] / this.accelerationSum[2]) *
        -(180 / Math.PI);
      phi =
        Math.atan(this.accelerationSum[1] / this.accelerationSum[2]) *
        (180 / Math.PI);
    }

    theta = Accelerometer.addAngleDegrees(
      theta,
      this.cfg.angleCorrection.theta
    );
    phi = Accelerometer.addAngleDegrees(phi, this.cfg.angleCorrection.phi);

    return {
      magnitude,
      theta,
      phi,
      reading: [
        this.accelerationSum[0] / this.bufferLen,
        this.accelerationSum[1] / this.bufferLen,
        this.accelerationSum[2] / this.bufferLen,
      ],
    };
  }
}
