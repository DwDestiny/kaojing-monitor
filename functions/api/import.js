import { importAnnouncements } from "../../api/src/index.js";

export const onRequestPost = async (context) => importAnnouncements(context.request, context.env);
