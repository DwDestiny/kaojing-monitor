import { updateFeedbackStatus } from "../../../../../api/src/index.js";

export const onRequestPost = async (context) =>
  updateFeedbackStatus(context.params.id, context.request, context.env);
