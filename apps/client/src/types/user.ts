export interface UserAccountStats {
  subjectsCount: number;
  conversationsCount: number;
  documentsCount: number;
  flashcardDecksCount: number;
  quizzesCount: number;
}

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  avatarStorageKey: string | null;
  role: string;
  isActive: boolean;
  isVerified: boolean;
  provider: string | null;
  hasPassword: boolean;
  createdAt: string;
  updatedAt: string;
  stats: UserAccountStats;
}

export interface UpdateUserProfileInput {
  name?: string;
  avatarStorageKey?: string;
}

export interface RequestAvatarUploadInput {
  fileName: string;
  mimeType: string;
  fileSize: number;
}

export interface AvatarUploadTicket {
  uploadUrl: string;
  storageKey: string;
}

export interface ChangePasswordInput {
  currentPassword?: string;
  newPassword: string;
}

export interface DeleteAccountInput {
  currentPassword?: string;
  confirmEmail?: string;
}
