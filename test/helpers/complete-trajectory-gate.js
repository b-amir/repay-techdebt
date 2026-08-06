/** Complete TrajectoryGate fixture for save-lesson happy-path tests. */
export const COMPLETE_TRAJECTORY_GATE = {
  mode: "fast",
  purposeDone: true,
  verifyDone: null,
  skipReasons: {},
};

/** JSON payload accepted by checkTrajectoryGate / --trajectory / trajectory-gate.json */
export function completeTrajectoryGatePayload() {
  return { gate: { ...COMPLETE_TRAJECTORY_GATE } };
}
