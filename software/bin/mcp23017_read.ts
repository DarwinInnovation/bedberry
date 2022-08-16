import "../server/common/env";
import l from "../server/logger";
import { parse } from "json5";
import { readFileSync } from "fs";

import { MCP23017, MCP23017PortId } from "../lib/MCP23017";
MCP23017.Init();
import { WbI2cBus } from "../lib/WbI2cBus";

function bin8(v: number): string {
  return ('' +
    ((v & 0x80)?'1':'0') +
    ((v & 0x40)?'1':'0') +
    ((v & 0x20)?'1':'0') +
    ((v & 0x10)?'1':'0') +
    ((v & 0x08)?'1':'0') +
    ((v & 0x04)?'1':'0') +
    ((v & 0x02)?'1':'0') +
    ((v & 0x01)?'1':'0')
  );
}

const i2cBus = new WbI2cBus(l, {
  busId: 1,
  devices: parse(readFileSync("./cfg/i2c.json5").toString()),
});

i2cBus.list()
const mcp: MCP23017 = i2cBus.FindByName("buttons");

const A = mcp.getPort(MCP23017PortId.A);
A.on("change", (diff: number, curValue: number) => {

  console.log("Change %s %s", bin8(diff), bin8(curValue));
});


// head up 1 down 8
// feet up 2 down 4
// platform up 32 down 16
