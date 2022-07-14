import { Logger, AlexaSkill, IntentItem, request, response } from "./AlexaSkill";
import { OkinBed } from "./OkinBed";

export class AlexaSkillOkin extends AlexaSkill {
  constructor(log: Logger, private okinBed: OkinBed) {
    super(log, "bed stead");
  }

  protected get_intents(): IntentItem[] {
    return [
      {
        name: "Move",
        schema: {
          slots: {
            actuator: "ActuatorSlotType",
            direction: "DirSlotType",
            duration: "AMAZON.NUMBER"
          }
        },
        handler: this.intent_Move
      },
      {
        name: "Stop",
        schema: {
          slots: {
            actuator: "ActuatorSlotType"
          }
        },
        handler: this.intent_Stop
      },
      {
        name: "Target",
        schema: {
          slots: {
            angle: "AMAZON.NUMBER"
          }
        },
        handler: this.intent_Target
      },
      {
        name: "SitUp",
        schema: {
          slots: {
          }
        },
        handler: this.intent_SitUp
      },
      {
        name: "Flat",
        schema: {
          slots: {

          }
        },
        handler: this.intent_Flat
      },
      {
        name: "Preset",
        schema: {
          slots: {
            presetId: "AMAZON.NUMBER"
          }
        },
        handler: this.intent_Preset
      },

    ];
  }

  protected intent_Move(request: request, response: response) {
    let reply = "Sorry. I'm confused.";
    const actuator = request.slot("actuator");
    const dir = request.slot("direction");
    const duration = parseInt(request.slot('duration', "5"));
    this.log.debug("Move: " + actuator + " " + dir);

    this.okinBed.move(actuator, dir == 'up', duration);
    reply = "moving " + actuator + " " + dir;

    this.say(response, reply);
  }

  protected intent_Stop(request: request, response: response) {
    let reply = "Sorry. I'm confused.";

    const actuator = request.slot("actuator");

    this.log.debug("Stop: " + actuator);

    this.okinBed.stop(actuator);
    reply = "stopping " + actuator;

    this.say(response, reply);
  }

  protected intent_Target(request: request, response: response) {
    let reply = "Sorry. I'm confused.";
    const angle = parseInt(request.slot("angle"));

    this.log.debug("Target: " + angle);

    this.okinBed.target(angle);
    reply = "moving to " + angle + " degrees";

    this.say(response, reply);
  }

  protected intent_SitUp(request: request, response: response) {
    let reply = "Sorry. I'm confused.";
    const angle = 60;

    this.log.debug("Target: " + angle);

    this.okinBed.target(angle);
    reply = "moving to " + angle + " degrees";

    this.say(response, reply);
  }

  protected intent_Flat(request: request, response: response) {
    let reply = "Sorry. I'm confused.";
    const angle = 0;

    this.log.debug("Target: " + angle);

    this.okinBed.target(angle);
    reply = "moving to " + angle + " degrees";

    this.say(response, reply);
  }


  protected intent_Preset(request: request, response: response) {
    let reply = "Sorry. I'm confused.";
    const preset = parseInt(request.slot("presetId"));

    this.log.debug("Preset: " + preset);

    this.okinBed.preset(preset);
    reply = "moving to preset " + preset;

    this.say(response, reply);
  }

  protected say(response: response, reply: string) {
    response.say("<prosody volume=\"x-soft\">" + reply + "</prosody>")
  }

}
