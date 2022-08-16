import fs from 'fs';
import path from 'path';

import json5 from 'json5';
import yargs, { string } from 'yargs';

import '../server/common/env';
import l from '../server/logger';

import { MCP23017, MCP23017PortId } from '../lib/MCP23017';
MCP23017.Init();
import { WbI2cBus } from '../lib/WbI2cBus';
import { AccelerometerPhidget } from '../lib/AccelerometerPhidget';
import { OkinBed } from '../lib/OkinBed';

const argv = yargs.argv;

function loadCfg(cfgDir: string, file: string): any {
  return json5.parse(fs.readFileSync(path.join(cfgDir, file), 'utf8'));
}
const cfgDir: string = 'cfg';

const i2cBus = new WbI2cBus(l, {
  busId: 1,
  devices: loadCfg(cfgDir, 'i2c.json5'),
});

const acc = new AccelerometerPhidget(l, loadCfg(cfgDir, 'accelerometer.json5'));

const bed = new OkinBed(l, 'bed', loadCfg(cfgDir, 'okin.json5'))

setTimeout(() => {
  let preset = argv._[0]
  if (typeof(preset) === "string") {
    preset = parseInt(preset);
  }
  bed.target(preset);
}, 1000);




