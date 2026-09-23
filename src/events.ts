import { EventEmitter } from "node:events";
import type { PhotoSession, UnassignedPhoto } from "./types.js";

export type PhotoReadyEvent = {
  type: "PHOTO_READY";
  filename: string;
  url: string;
  createdAt: string;
  sessionCode?: string | null;
  sessionName?: string | null;
};

export type SessionBusEvent = {
  type: string;
  session?: PhotoSession;
  photo?: UnassignedPhoto;
  at?: string;
};

class AgentEventBus extends EventEmitter {
  emitPhotoReady(payload: Omit<PhotoReadyEvent, "type" | "createdAt">): PhotoReadyEvent {
    const event: PhotoReadyEvent = {
      type: "PHOTO_READY",
      createdAt: new Date().toISOString(),
      ...payload,
    };
    this.emit("photo_ready", event);
    return event;
  }

  onPhotoReady(listener: (event: PhotoReadyEvent) => void): () => void {
    this.on("photo_ready", listener);
    return () => this.off("photo_ready", listener);
  }

  emitSessionEvent(payload: SessionBusEvent): SessionBusEvent {
    const event: SessionBusEvent = {
      ...payload,
      at: new Date().toISOString(),
    };
    this.emit("session_event", event);
    return event;
  }

  onSessionEvent(listener: (event: SessionBusEvent) => void): () => void {
    this.on("session_event", listener);
    return () => this.off("session_event", listener);
  }
}

export const agentEvents = new AgentEventBus();
