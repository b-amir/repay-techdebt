// Dialogue & checkpoints (C2) public API.
// When you make a function public, add it to this barrel.
export { buildDialogueEnvelope, topicSignalClass } from "./dialogue-envelope.js";

export {
  WORKBOOK_TRAJECTORY,
  FOCUSED_TRAJECTORY,
  PR_TRAJECTORY,
  validateTrajectory,
  stubWorkbookTrajectory,
  derivePathComplete,
  buildTrajectoryGate,
  validateTrajectoryGateShape,
  listPathMissing,
  checkTrajectoryGate,
  formatPathIncompleteReason,
  refuseSaveIfPathIncomplete,
} from "./trajectory.js";
