import { getStats } from "../../api/src/index.js";

export const onRequestGet = async (context) => getStats(context.env);
