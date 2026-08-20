import { adminVerify } from "../../../api/src/index.js";

export const onRequestPost = async (context) => adminVerify(context.request, context.env);
