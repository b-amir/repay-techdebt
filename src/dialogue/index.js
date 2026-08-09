// Dialogue & checkpoints (C2) public API.
// When you make a function public, add it to this barrel.
export {
  buildDialogueEnvelope,
  CLOSED_NEXT_ASK_DOS,
  topicSignalClass,
} from "./dialogue-envelope.js";

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

export {
  FLOW_STATES,
  USER_STEPS,
  FLOW_TRANSITIONS,
  PROGRESS_SCENARIOS,
  buildProgressSteps,
  canTransition,
  validateFlow,
} from "./flow-machine.js";
