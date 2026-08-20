import { getAnnouncements } from "../../../api/src/index.js";

export const onRequestGet = async (context) => getAnnouncements(context.request, context.env);
