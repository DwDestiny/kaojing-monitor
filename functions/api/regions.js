import { getRegions } from "../../api/src/index.js";

export const onRequestGet = async (context) => getRegions(context.env);
