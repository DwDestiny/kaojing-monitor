import { getAnnouncementById } from "../../../../api/src/index.js";

export const onRequestGet = async (context) => getAnnouncementById(context.params.id, context.env);
