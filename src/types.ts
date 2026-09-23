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
