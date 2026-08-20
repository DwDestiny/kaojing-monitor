import { submitFeedback } from "../../../api/src/index.js";

export const onRequestPost = async (context) => submitFeedback(context.request, context.env);
