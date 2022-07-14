import { Logger } from "./Logger";
export { Logger } from "./Logger";

import { app as AlexaApp, IntentSchema, request, response } from "alexa-app";

export { app as AlexaApp, IntentSchema, request, response } from "alexa-app";

export interface IntentItem {
  name: string;
  schema: IntentSchema;
  handler: (request: request, response: response) => void;
}

export class AlexaSkill {
  static Registry = new Map<string, AlexaSkill>();

  static findByName(name: string) {
    return AlexaSkill.Registry.get(name);
  }

  static each(cb) {
    AlexaSkill.Registry.forEach(cb);
  }

  private alexa_app: AlexaApp;
  public phonetic_name: string;

  constructor(
    protected log: Logger,
    public name: string,
    phonetic_name_?: string
  ) {
    this.alexa_app = new AlexaApp(name);

    if (phonetic_name_) {
      this.phonetic_name = phonetic_name_;
    } else {
      this.phonetic_name = this.name;
    }

    this._bind_intents();

    AlexaSkill.Registry.set(name, this);
  }

  public express(express_app: Express.Application, endpoint?: string) {
    this.alexa_app.express({
      expressApp: express_app,
      endpoint,
    });
  }

  protected onLaunch(request, response) {
    response.shouldEndSession(false).say(this.phonetic_name + "?");
  }

  protected getHelpResponse(): string {
    return "You can say commands.";
  }

  protected intent_AMAZON_HelpIntent(request, response) {
    response
      .say(this.getHelpResponse())
      .reprompt("What would you like to do?")
      .shouldEndSession(false);
  }

  protected intent_AMAZON_StopIntent(request, response) {
    response.say("App stopped");
  }

  protected intent_AMAZON_CancelIntent(request, response) {
    response.say("Okay. Cancelled");
  }

  protected get_intents(): IntentItem[] {
    return [];
  }

  private _bind_intents() {
    const app = this.alexa_app;
    app.launch(this.onLaunch.bind(this));

    app.intent(
      "AMAZON.HelpIntent",
      {
        slots: {},
        utterances: [],
      },
      this.intent_AMAZON_HelpIntent.bind(this)
    );

    app.intent(
      "AMAZON.StopIntent",
      {
        slots: {},
        utterances: [],
      },
      this.intent_AMAZON_StopIntent.bind(this)
    );

    app.intent(
      "AMAZON.CancelIntent",
      {
        slots: {},
        utterances: [],
      },
      this.intent_AMAZON_CancelIntent.bind(this)
    );

    const intents = this.get_intents();
    for (const intent of intents) {
      app.intent(intent.name, intent.schema, intent.handler.bind(this));
    }
  }
}
