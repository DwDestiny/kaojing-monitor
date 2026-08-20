import { extractFields } from "../../../../api/src/index.js";

export const onRequestPost = async (context) => extractFields(context.request, context.env);
