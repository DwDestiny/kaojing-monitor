import { getAdminFeedback } from "../../../api/src/index.js";

export const onRequestGet = async (context) => getAdminFeedback(context.request, context.env);
