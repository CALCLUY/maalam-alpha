export { Blackboard } from "./Board";
export {
  ASK_INTERACTIVE_TOOL,
  BOARD_FUNCTION_DECLARATIONS,
  BOARD_TOOL_NAMES,
  LESSON_POINT_COMPLETE_TOOL,
} from "./tools";
export {
  applyBoardClear,
  applyBoardRemove,
  applyBoardWrite,
  findDuplicateBlock,
  insertPreparedBlock,
  isDuplicateBody,
  pickErasable,
  prepareBoardWrite,
  replaceZone,
  zoneHasRoomFor,
  zoneInk,
} from "./state";
export type { BoardWriteArgs, DuplicateCandidate, PreparedWrite } from "./state";
export { buildFormalZoneFromAnalysis, buildPointHeading, buildEmptyRightZone } from "./seed";
export { extractBoardBlocksFromTranscript } from "./autoSync";
export { blockMentionedInSpeech, exampleMentionedInSpeech, isExampleWrite, isValidExampleArgs } from "./speechGate";
export {
  hasArabicScript,
  looksLikeEquation,
  MAX_QUESTION_CHARS,
  normalizeBoardWriteDefinition,
  normalizeBoardWriteMath,
  normalizeBoardWriteQuestion,
  sanitizeBoardWriteText,
} from "./guard";
export type { BoardBlock, BoardBlockType, BoardZone, ChalkColor } from "./types";
export { applyBoardAnnotate, MAX_ACTIVE_ARROWS } from "./annotate";
export { playChalkEraseSound } from "./chalkAudio";
export {
  applyBoardConnect,
  assignConnectorSides,
  connectorGutters,
  countActiveArrows,
  expireStaleConnectors,
  pruneConnectors,
} from "./connect";
export type { ConnectorSide } from "./connect";
export type { AnnotationKind, BoardAnnotation, BoardConnector } from "./types";
