import fs from "fs";
import path from "path";

import { default as express, Express } from "express";

import "./common/env";
import l from "./logger";

import json5 from "json5";

import { MCP23017 } from "../lib/MCP23017";
MCP23017.Init();
import { WbI2cBus } from "../lib/WbI2cBus";

import { AccelerometerPhidget } from "../lib/AccelerometerPhidget";

import { OkinBed } from "../lib/OkinBed";
import { OkinRemote } from "../lib/OkinRemote";
import { AlexaSkillOkin } from "../lib/AlexaSkillOkin";
import { MultiButton } from "../lib/MultiButton";

const cfgDir: string = "cfg";

function loadCfg(cfgDir: string, file: string): any {
  return json5.parse(fs.readFileSync(path.join(cfgDir, file), "utf8"));
}

const i2cBus = new WbI2cBus(l, {
  busId: 1,
  devices: loadCfg(cfgDir, "i2c.json5"),
});

const acc = new AccelerometerPhidget(l, loadCfg(cfgDir, "accelerometer.json5"));

const bed = new OkinBed(l, "bed", loadCfg(cfgDir, "okin.json5"));

const bedRemote = new OkinRemote(l, bed, loadCfg(cfgDir, "okinRemote.json5"));

if (fs.existsSync(path.join(cfgDir, "multibutton.json5"))) {
  const multibutton = new MultiButton(
    l,
    bed,
    loadCfg(cfgDir, "multibutton.json5")
  );
}

var express_app = express();

// view engine setup
express_app.set("views", path.join(__dirname, "../views"));
express_app.set("view engine", "pug");
express_app.set("trust proxy", 1);

// now POST calls to /sample in express will be handled by the app.request() function
// GET calls will not be handled

express_app.use(express.static(path.join(__dirname, "../../public")));

const bedSkill = new AlexaSkillOkin(l, bed);
bedSkill.express(express_app, "alexa");

// from here on, you can setup any other express routes or middleware as norm
const PORT = process.env.PORT || 3092;

l.info("Listening on port %d", PORT);
express_app.listen(PORT);
