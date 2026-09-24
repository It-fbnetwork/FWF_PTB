export type SessionStatus =
  | "WAITING"
  | "SELECTED"
  | "READY"
  | "CAPTURED"
  | "PROCESSING"
  | "READY_TO_DISPLAY"
  | "DISPLAYING"
  | "COMPLETED"
  | "FAILED"
  | "CANCELLED";

export type SessionPhoto = {
  id: string;
  originalFilename: string;
  processedFilename: string;
  url: string;
  createdAt: string;
};

export type PhotoSession = {
  id: string;
  code: string;
  name: string;
  phone: string;
  status: SessionStatus;
  selectedFrameId: string;
  consentAt: string;
  createdAt: string;
  capturedAt: string | null;
  completedAt: string | null;
  selectedPhotoId: string | null;
  photos: SessionPhoto[];
};

export type UnassignedPhoto = {
  id: string;
  originalFilename: string;
  processedFilename: string;
  url: string;
  createdAt: string;
};

export type PollEvent =
  | { type: "photo_ready"; filename: string; url: string; sessionCode: string | null; sessionName: string | null; createdAt: string }
  | { type: "frame_preview"; frameId: string; frameUrl: string; createdAt: string }
  | { type: "frame_preview_clear"; createdAt: string }
  | { type: "session_event"; eventType: string; session: PhotoSession; createdAt: string };
