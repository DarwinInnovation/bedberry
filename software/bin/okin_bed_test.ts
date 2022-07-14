import "../server/common/env";
import l from "../server/logger";

import { MCP23017, MCP23017PortId } from "../lib/MCP23017";
MCP23017.Init();
import { WbI2cBus } from "../lib/WbI2cBus";

import { OkinBed } from "../lib/OkinBed";

const i2cBus = new WbI2cBus(l, {
  busId: 1,
  devices: [
    {
      address: 0x20,
      type: "mcp",
      name: "okin",
      details: {
        A: {},
        B: {
          write_bits: 0x7f,
        },
      },
    },
    // {
    //   address: 0x24,
    //   type: 'mcp',
    //   name: 'okin_control',
    // },
  ],
});

const mcp: MCP23017 = i2cBus.FindByName("okin");

const A = mcp.getPort(MCP23017PortId.A);
A.on("change", (diff: number, curValue: number) => {
  l.info("Change %s %s", diff.toString(16), curValue.toString(16));
});

const okinBed = new OkinBed(l, "okin", {
  mcp_port: "okin.B",
  max_move_duration: 60,
  head: {
    up: 0,
    down: 3,
  },
  feet: {
    up: 2,
    down: 1,
  },
  platform: {
    up: 5,
    down: 4,
  },
  control: [],
  presetAngles: [40, 35, 30, 22, 15, 8, 0],
});
const a = "head";

okinBed.up(a, 45);
setTimeout(() => {
  okinBed.down(a, 60);
}, 45000);
