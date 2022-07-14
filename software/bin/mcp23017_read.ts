import "../server/common/env";
import l from "../server/logger";
import { parse } from "json5";
import { readFileSync } from "fs";

import { MCP23017, MCP23017PortId } from "../lib/MCP23017";
MCP23017.Init();
import { WbI2cBus } from "../lib/WbI2cBus";

const i2cBus = new WbI2cBus(l, {
  busId: 1,
  devices: parse(readFileSync("./cfg/i2c.json5").toString()),
});

i2cBus.list()
const mcp: MCP23017 = i2cBus.FindByName("mcp.buttons");


const A = mcp.getPort(MCP23017PortId.A);
A.on("change", (diff: number, curValue: number) => {
  l.info("Change %s %s", diff.toString(16), curValue.toString(16));
});


// head up 1 down 8
// feet up 2 down 4
// platform up 32 down 16
