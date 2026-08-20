import { classifyContent } from "../../../api/src/index.js";

export const onRequestPost = async (context) => classifyContent(context.request, context.env);
