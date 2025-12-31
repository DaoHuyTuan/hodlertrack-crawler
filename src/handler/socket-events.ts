import { CRAWLER_EVENTS } from "../utils/variables";

export interface Event<T> {
  type: string;
  data: T;
}

export class SocketEventsHandler<T> {
  private event: Event<T>;

  constructor(event: Event<T>) {
    this.event = event;
  }

  private exec = () => {
    switch (this.event.type) {
      case CRAWLER_EVENTS.COMMAND:
        return this.command(this.event.data);
      case CRAWLER_EVENTS.EVENTS:
        return;
      default:
        return null;
    }
  };

  private events = (data: T) => {};

  private command = (data: T) => {};
}
