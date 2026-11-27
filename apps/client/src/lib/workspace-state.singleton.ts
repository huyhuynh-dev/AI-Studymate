import { workspaceStateApi } from '@/services/workspaceState.api';
import { WorkspaceStateCoordinator } from '@/lib/workspace-state-coordinator';

export const workspaceStateCoordinator = new WorkspaceStateCoordinator({
  transport: workspaceStateApi,
});
