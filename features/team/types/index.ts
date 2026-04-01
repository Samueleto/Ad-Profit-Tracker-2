// Step 147: TypeScript types for team and invitation models

import type { Timestamp } from 'firebase-admin/firestore';

export type WorkspaceRole = 'owner' | 'admin' | 'member';

export interface WorkspaceInvitation {
  id: string;
  workspaceId: string;
  workspaceName: string;
  invitedByUid: string;
  invitedByName: string;
  invitedEmail: string;
  role: 'admin' | 'member';
  token: string;
  tokenHash: string;
  personalMessage: string | null;
  status: 'pending' | 'accepted' | 'declined' | 'revoked' | 'expired';
  expiresAt: Timestamp;
  acceptedAt: Timestamp | null;
  acceptedByUid: string | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export type WorkspaceInvitationSafe = Omit<WorkspaceInvitation, 'token' | 'tokenHash'>;

export interface WorkspaceMember {
  uid: string;
  displayName: string;
  email: string;
  workspaceRole: WorkspaceRole;
  workspaceJoinedAt: Timestamp;
  photoURL: string | null;
}

export interface WorkspaceMetadata {
  workspaceId: string;
  workspaceName: string;
  ownerUid: string;
  memberCount: number;
  createdAt: Timestamp;
  currentUserRole: WorkspaceRole;
}

export interface CreateInvitationRequest {
  email: string;
  role: 'admin' | 'member';
  personalMessage?: string;
}

export interface UpdateRoleRequest {
  role: 'admin' | 'member';
}

export interface ApiError {
  status: number;
  message: string;
  code?: string;
}
